// Local JSON WAL: a durable prepared intention is rolled forward before any
// subsequent adapter read or write. The storage adapter holds a cross-process
// directory lock around this journal; raw external readers still do not receive
// instantaneous atomic visibility across both account files.
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,rename,rm,open} from 'node:fs/promises';
import path from 'node:path';

const ROOM=/^[A-Za-z0-9_-]{1,64}$/, OPERATION=/^[A-Za-z0-9:_-]{1,160}$/;
const sha=value=>createHash('sha256').update(value).digest('hex');
const failure=(code,message)=>Object.assign(new Error(message||code),{code});
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
export const pairFingerprint=entries=>sha(JSON.stringify(sorted(entries.map(({userId,state})=>({userId,state})))));
async function maybeRead(file){try{return await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function syncJsonDirectory(dir){if(process.platform==='win32')return;const fd=await open(dir,'r');try{await fd.sync();}finally{await fd.close();}}
export async function durableJsonWrite(target,text){
 const folder=path.dirname(target),tmp=`${target}.${randomUUID()}.tmp`;
 await mkdir(folder,{recursive:true,mode:0o700});
 try{const fd=await open(tmp,'wx',0o600);try{await fd.writeFile(text,'utf8');await fd.sync();}finally{await fd.close();}await rename(tmp,target);await syncJsonDirectory(folder);}
 finally{await rm(tmp,{force:true}).catch(()=>{});}
}
export class JsonPairJournal{
 constructor(saveDir,{writeState,validateState}){this.folder=path.join(saveDir,'.transactions');this.pending=path.join(this.folder,'pending.json');this.writeState=writeState;this.validateState=validateState;this.saveDir=saveDir;}
 receiptPath(id){return path.join(this.folder,'committed',`${sha(id)}.json`);}
 async receipt(id){const raw=await maybeRead(this.receiptPath(id));if(raw===null)return null;let record;try{record=JSON.parse(raw);}catch{throw failure('STORAGE_PAIR_RECEIPT_CORRUPT');}if(record.operationId!==id||!/^[a-f0-9]{64}$/.test(record.fingerprint))throw failure('STORAGE_PAIR_RECEIPT_CORRUPT');return record;}
 normalize(entries,id){
  if(!OPERATION.test(id)||!Array.isArray(entries)||entries.length!==2)throw failure('STORAGE_PAIR_INVALID');
  const ordered=[...entries].sort((a,b)=>String(a.userId).localeCompare(String(b.userId)));
  if(ordered.some(entry=>!ROOM.test(entry?.userId))||ordered[0].userId===ordered[1].userId)throw failure('STORAGE_PAIR_INVALID');
  const sanitized=ordered.map(({userId,state})=>{const text=JSON.stringify(this.validateState(state));return {userId,state:this.validateState(JSON.parse(text)),text};});
  return {ordered:sanitized,fingerprint:pairFingerprint(sanitized)};
 }
 validateManifest(value){
  if(value?.version!==1||!OPERATION.test(value.operationId)||!Array.isArray(value.entries)||value.entries.length!==2)throw failure('STORAGE_PAIR_JOURNAL_CORRUPT');
  const rows=value.entries;
  if(rows.some(entry=>!ROOM.test(entry.userId)||typeof entry.text!=='string'||!/^([a-f0-9]{64})$/.test(entry.afterHash)||!(entry.beforeHash===null||/^[a-f0-9]{64}$/.test(entry.beforeHash))))throw failure('STORAGE_PAIR_JOURNAL_CORRUPT');
  if(rows[0].userId===rows[1].userId||rows.some(entry=>sha(entry.text)!==entry.afterHash))throw failure('STORAGE_PAIR_JOURNAL_CORRUPT');
  try{const normalized=this.normalize(rows.map(entry=>({userId:entry.userId,state:JSON.parse(entry.text)})),value.operationId);if(normalized.fingerprint!==value.fingerprint)throw Error();}catch{throw failure('STORAGE_PAIR_JOURNAL_CORRUPT');}
  return value;
 }
 async recover(){
  const raw=await maybeRead(this.pending);if(raw===null)return false;
  let manifest;try{manifest=this.validateManifest(JSON.parse(raw));}catch{throw failure('STORAGE_PAIR_JOURNAL_CORRUPT','Invalid pending pair WAL; manual recovery required, no save overwritten');}
  for(const entry of manifest.entries){
   const current=await maybeRead(path.join(this.saveDir,`${entry.userId}.json`)),hash=current===null?null:sha(current);
   if(hash===entry.afterHash)continue;
   if(hash!==entry.beforeHash)throw failure('STORAGE_PAIR_RECOVERY_CONFLICT',`Save diverged during pair recovery: ${entry.userId}`);
   await this.writeState(entry.userId,entry.text);
  }
  await this.writeReceipt(manifest.operationId,manifest.fingerprint);
  await rm(this.pending);await syncJsonDirectory(this.folder);return true;
 }
 async writeReceipt(id,fingerprint){
  const previous=await this.receipt(id);
  if(previous){if(previous.fingerprint!==fingerprint)throw failure('STORAGE_PAIR_ID_CONFLICT');return;}
  await durableJsonWrite(this.receiptPath(id),JSON.stringify({version:1,operationId:id,fingerprint}));
 }
 async commit(entries,id,{onPrepared}={}){
  const {ordered,fingerprint}=this.normalize(entries,id),existing=await this.receipt(id);
  if(existing){if(existing.fingerprint!==fingerprint)throw failure('STORAGE_PAIR_ID_CONFLICT');return {duplicate:true};}
  const journalEntries=[];
  for(const entry of ordered){const old=await maybeRead(path.join(this.saveDir,`${entry.userId}.json`));journalEntries.push({userId:entry.userId,text:entry.text,beforeHash:old===null?null:sha(old),afterHash:sha(entry.text)});}
  // Caller marks itself unsafe *before* writing WAL, because a directory fsync
  // failure after rename has an indeterminate outcome.
  onPrepared?.();await durableJsonWrite(this.pending,JSON.stringify({version:1,operationId:id,fingerprint,entries:journalEntries}));
  await this.recover();return {duplicate:false};
 }
}
