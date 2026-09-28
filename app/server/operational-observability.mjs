// B30: bounded, allowlisted operational diagnostics. User-supplied payloads,
// account identifiers, headers and Error.message/stack never enter the journal.
import {randomUUID} from 'node:crypto';

const finite=value=>Number.isFinite(value)&&value>=0?value:0;
const integer=value=>Number.isSafeInteger(value)&&value>=0?value:0;
// Exact allowlist prevents accidentally treating a user-controlled error code as safe.
const ERROR_CODES=new Set(['STORAGE_TIMEOUT','STORAGE_UNAVAILABLE','STORAGE_REVISION_CONFLICT','STORAGE_PAIR_CROSS_BACKEND','STORAGE_PAIR_RESTART_REQUIRED','STORAGE_RESPONSE_TOO_LARGE','STORAGE_HTTP_ERROR','STORAGE_BAD_JSON','STORAGE_CANCELLED','STORAGE_REQUEST_DEADLINE','STORAGE_PAIR_FAILED','RANKED_SETTLEMENT_RECEIPT_CONFLICT','STORAGE_NOT_READY','DURABLE_WRITE_FAILED']);
const safeCode=value=>ERROR_CODES.has(value)?value:'UNCLASSIFIED_ERROR';
const DOMAINS=new Set(['storage','ws-action','ranked','lifecycle','readiness']);
const OUTCOMES=new Set(['ok','error','retry']);
const OPERATIONS=new Set(['save','savePair','restore','action','settlement','tick','probe']);

/** In-memory retention is bounded; no player data or logfile is stored. */
export class OperationsJournal{
 constructor({maxEntries=128,now=()=>Date.now(),write=()=>{}}={}){
  this.maxEntries=Math.max(1,Math.min(1024,integer(maxEntries)||128));
  this.entries=[];this.counts={ok:0,error:0,retry:0};this.now=now;this.write=write;
 }
 record({domain,operation,outcome='error',errorCode,elapsedMs=0,retryCount=0,revision}={}){
  // Construct a fresh object from the fixed schema. Do not spread input/error.
  const entry={at:integer(this.now()),operationId:randomUUID(),domain:DOMAINS.has(domain)?domain:'lifecycle',operation:OPERATIONS.has(operation)?operation:'tick',outcome:OUTCOMES.has(outcome)?outcome:'error',elapsedMs:Math.round(finite(elapsedMs)*1000)/1000,retryCount:integer(retryCount),code:outcome==='ok'?null:safeCode(errorCode)};
  if(Number.isSafeInteger(revision)&&revision>=0)entry.revision=revision;
  this.counts[entry.outcome]++;
  this.entries.push(entry);if(this.entries.length>this.maxEntries)this.entries.shift();
  try{this.write(entry);}catch{ /* The diagnostic sink must never break game saves. */ }return entry.operationId;
 }
 snapshot({includeRecent=false}={}){return {counts:{...this.counts},retained:this.entries.length,limit:this.maxEntries,...(includeRecent?{recent:this.entries.map(entry=>({...entry}))}:{})};}
}

/** No upstream details on this public endpoint. Singleflight + TTL + deadline. */
export class ReadinessGate{
 constructor({probe,now=()=>Date.now(),ttlMs=5000,deadlineMs=900,onFailure=()=>{}}){
  this.probe=probe;this.now=now;this.ttlMs=Math.max(1000,ttlMs);this.deadlineMs=Math.max(100,deadlineMs);this.onFailure=onFailure;
  this.lastAt=-Infinity;this.last=false;this.inFlight=null;
 }
 async ready(){
  if(this.now()-this.lastAt<this.ttlMs)return this.last;
  if(this.inFlight)return this.inFlight;
  this.inFlight=this.check();try{return await this.inFlight;}finally{this.inFlight=null;}
 }
 async check(){
  let timer;const controller=new AbortController();
  const started=this.now();
  try{
   // A hung probe must not block public requests; a late rejection is handled
   // by Promise.race's registered handler. The probe is read-only.
   const status=await Promise.race([Promise.resolve().then(()=>this.probe(controller.signal)),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(false);},this.deadlineMs);})]);
   this.last=status===true;
  }catch{this.last=false;}
  finally{clearTimeout(timer);this.lastAt=this.now();if(!this.last)this.onFailure({elapsedMs:Math.max(0,this.now()-started)});}
  return this.last;
 }
}

export function settlementHealth(matches,now=Date.now()){
 let count=0,oldestPendingAgeMs=0,retryCount=0;
 for(const match of matches){if(match.settled||!Number.isFinite(match.settlementPendingAt))continue;
  count++;oldestPendingAgeMs=Math.max(oldestPendingAgeMs,Math.max(0,now-match.settlementPendingAt));retryCount+=integer(match.settlementRetries);
 }
 return {pendingCount:count,oldestPendingAgeMs,retryCount};
}

/** Fixed, tunable defaults; these are signals, not a claimed production SLO. */
export function operationalAlerts({runtime={},rooms={},settlement={},thresholds={}}={}){
 const limits={queueWaitMs:15_000,persistP95Ms:1000,lagP95Ms:500,settlementAgeMs:10_000,rssBytes:768*1024*1024,...thresholds};
 const alerts=[];
 const add=(trigger,code,measured,limit)=>{if(trigger)alerts.push({code,measured,limit});};
 add((rooms.oldestQueueWaitMs||0)>limits.queueWaitMs,'QUEUE_WAIT',rooms.oldestQueueWaitMs||0,limits.queueWaitMs);
 add((runtime.persist?.recentSamples||0)>=10&&(runtime.persist?.p95Ms||0)>limits.persistP95Ms,'PERSIST_SLOW',runtime.persist.p95Ms,limits.persistP95Ms);
 add((runtime.eventLoop?.recentSamples||0)>=10&&(runtime.eventLoop?.p95Ms||0)>limits.lagP95Ms,'EVENT_LOOP_LAG',runtime.eventLoop.p95Ms,limits.lagP95Ms);
 add((settlement.oldestPendingAgeMs||0)>limits.settlementAgeMs,'SETTLEMENT_PENDING',settlement.oldestPendingAgeMs||0,limits.settlementAgeMs);
 add((runtime.memory?.rssBytes||0)>limits.rssBytes,'MEMORY_RSS',runtime.memory.rssBytes,limits.rssBytes);
 add((runtime.persist?.recentErrors||0)>0,'PERSIST_ERRORS',runtime.persist?.recentErrors||0,0);
 return alerts;
}
