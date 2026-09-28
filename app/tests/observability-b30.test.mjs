import test from 'node:test';
import assert from 'node:assert/strict';
import {OperationsJournal,ReadinessGate,settlementHealth,operationalAlerts} from '../server/operational-observability.mjs';
import {RuntimeMetrics,instrumentPersistence} from '../server/runtime-metrics.mjs';
import {RankedService} from '../server/ranked-v1.mjs';
import {createLocalServer} from '../local-server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sentinel='Bearer SECRET_cookie_customer_private_123';
const newJournal=()=>{const written=[];return {journal:new OperationsJournal({maxEntries:3,now:()=>123,write:entry=>written.push(entry)}),written};};
test('B30 journal strictly allowlists fields/codes, retains only last 3 and no secret even on failed save',async()=>{
 const {journal,written}=newJournal(),metrics=new RuntimeMetrics();
 const storage={async save(_user,_save){throw Object.assign(Error(sentinel),{code:`INVALID_${sentinel}`});}};
 instrumentPersistence(storage,metrics,['save'],event=>journal.record({domain:'storage',outcome:'error',...event,headers:{authorization:sentinel},accountId:sentinel}));
 await assert.rejects(storage.save(sentinel,{secret:sentinel}));
 assert.equal(metrics.snapshot().persist.errors,1);
 for(let i=0;i<12;i++)journal.record({domain:'ws-action',operation:'action',outcome:'error',errorCode:'DURABLE_WRITE_FAILED',message:sentinel,token:sentinel});
 assert.equal(journal.snapshot().counts.error,13);
 assert.equal(journal.snapshot().retained,3);
 const encoded=JSON.stringify([journal.snapshot({includeRecent:true}),written]);
 assert.doesNotMatch(encoded,/SECRET_cookie|authorization|accountId|message|headers|token/);
 assert.equal(written[0].code,'UNCLASSIFIED_ERROR');
 assert.match(written[0].operationId,/^[0-9a-f-]{36}$/);
 assert.equal(written[0].operation,'save');
 journal.record({domain:'storage',operation:'save',outcome:'ok',revision:12});assert.equal(journal.snapshot().counts.ok,1);
});
test('B30 readiness is singleflight, caches failures and success, and never exposes failure text',async()=>{
 let now=1000,probes=0,resolve,failed=0;
 const gate=new ReadinessGate({now:()=>now,ttlMs:5000,deadlineMs:100,probe:()=>{probes++;return new Promise(r=>{resolve=r;});},onFailure:()=>{failed++;}});
 const a=gate.ready(),b=gate.ready();await Promise.resolve();assert.equal(probes,1);resolve(false);
 assert.deepEqual(await Promise.all([a,b]),[false,false]);assert.equal(await gate.ready(),false);assert.equal(probes,1);assert.equal(failed,1);
 now+=5001;const c=gate.ready();await Promise.resolve();resolve(true);assert.equal(await c,true);assert.equal(probes,2);
 const thrown=new ReadinessGate({probe:()=>{throw Error(sentinel);}});assert.equal(await thrown.ready(),false);
 const stalled=new ReadinessGate({probe:()=>new Promise(()=>{}),deadlineMs:120});assert.equal(await stalled.ready(),false);
});
test('B30 alerts are deterministic and settlement health excludes settled matches',()=>{
 const settlement=settlementHealth([{settled:false,settlementPendingAt:100,settlementRetries:3},{settled:true,settlementPendingAt:1},{settled:false,settlementPendingAt:190}],210);
 assert.deepEqual(settlement,{pendingCount:2,oldestPendingAgeMs:110,retryCount:3});
 const codes=operationalAlerts({runtime:{persist:{errors:1,recentErrors:1,p95Ms:1200,recentSamples:20},eventLoop:{p95Ms:700,recentSamples:20},memory:{rssBytes:900}},rooms:{oldestQueueWaitMs:20},settlement,thresholds:{queueWaitMs:10,persistP95Ms:1000,lagP95Ms:500,settlementAgeMs:100,rssBytes:800}}).map(row=>row.code);
 assert.deepEqual(codes,['QUEUE_WAIT','PERSIST_SLOW','EVENT_LOOP_LAG','SETTLEMENT_PENDING','MEMORY_RSS','PERSIST_ERRORS']);
});
test('B30 failed settlement remains visible until successful durable retry',async()=>{
 const failures=[],ranked=new RankedService({catalog:{},clock:{now:()=>5000},onSettlementFailure:e=>failures.push(e)});
 const match={id:'synthetic',settled:false};ranked.matches.set(match.id,match);
 ranked.commitSettlement=async()=>{throw Object.assign(Error(sentinel),{code:'STORAGE_TIMEOUT'});};
 await assert.rejects(ranked.settle(match),/SECRET_cookie/);
 assert.equal(failures[0].errorCode,'STORAGE_TIMEOUT');assert.equal(settlementHealth(ranked.matches.values(),6000).oldestPendingAgeMs,1000);
 ranked.commitSettlement=async()=>{match.settled=true;};await ranked.settle(match);
 assert.deepEqual(settlementHealth(ranked.matches.values(),6000),{pendingCount:0,oldestPendingAgeMs:0,retryCount:0});
});
test('B30 HTTP liveness and readiness differ; diagnostics are admin-only and no-store',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-b30-'));let ok=false,probes=0;
 const app=createLocalServer({saveDir:dir,readinessProbe:async()=>{probes++;return ok;}});
 try{
  const port=await app.listen(0),url=`http://127.0.0.1:${port}`;
  const live=await fetch(url+'/health/live'),notReady=await fetch(url+'/health/ready');
  assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'ok'});
  assert.equal(notReady.status,503);assert.equal(notReady.headers.get('cache-control'),'no-store');assert.deepEqual(await notReady.json(),{status:'unavailable'});
  const second=await fetch(url+'/health/ready');assert.equal(second.status,503);assert.equal(probes,1);
  const denied=await fetch(url+'/api/admin/observability');assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'no-store');
  const snapshot=app.resourceSnapshot();assert.equal(snapshot.operations.counts.error,1);assert.ok(Array.isArray(snapshot.alerts));
  // No authenticated admin session was forged to test access.
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
