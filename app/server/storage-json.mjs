import {readFile,mkdir,rename,access,readdir,rm,open,link,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {validCampaignId} from './admin-campaigns.mjs';
import {durableJsonWrite,JsonPairJournal} from './json-pair-journal.mjs';
import {parseAdventureSave,validateAdventureSave} from './save-schema.mjs';
import {StorageDirectoryLock} from './storage-directory-lock.mjs';

// A sync of the containing directory makes completed renames more durable on
// POSIX filesystems. Windows does not expose equivalent directory fsync here.
async function syncDirectory(folder){
 if(process.platform==='win32')return;
 const handle=await open(folder,'r');try{await handle.sync();}finally{await handle.close();}
}
import path from 'node:path';

const ROOM=/^[A-Za-z0-9_-]{1,64}$/,BACKUP_VERSION=1,sha=value=>createHash('sha256').update(value).digest('hex');
const validateState=validateAdventureSave;
// One in-process IO queue per save directory serializes local readers/writers,
// including multiple adapter instances. Separate Node processes are unsupported.
const queues=new Map();
export class JsonAdventureStorage{
 constructor(saveDir,{now=()=>Date.now(),backupRetention=20,staleTempMs=60*60*1000,lockTimeoutMs=10_000,staleLockMs=120_000}={}){
  this.saveDir=path.resolve(saveDir);this.staleAfterFailedPair=false;this.ready=false;
  this.now=now;this.backupRetention=Math.max(1,Math.min(1000,backupRetention));this.staleTempMs=staleTempMs;
  if(!queues.has(this.saveDir))queues.set(this.saveDir,{tail:Promise.resolve(),ready:false,needsRecovery:false});
  this.queue=queues.get(this.saveDir);
  this.directoryLock=new StorageDirectoryLock(this.saveDir,{timeoutMs:lockTimeoutMs,staleMs:staleLockMs});
  this.pairJournal=new JsonPairJournal(this.saveDir,{validateState,writeState:(room,text)=>this.writeState(room,text)});
 }
 async locked(work){
  const q=this.queue,job=q.tail.then(async()=>{
   if(this.staleAfterFailedPair)throw Object.assign(new Error('Local pair write failed; restart server and reload both accounts before more operations'),{code:'STORAGE_PAIR_RESTART_REQUIRED'});
   const release=await this.directoryLock.acquire();try{await this.pairJournal.recover();if(!this.ready)await this.cleanupStaleTemps();this.ready=true;q.needsRecovery=false;return await work();}catch(error){q.needsRecovery=true;throw error;}finally{await release();}
  });q.tail=job.catch(()=>{});return job;
 }
 async cleanupStaleTemps(){
  let names;try{names=await readdir(this.saveDir);}catch(error){if(error.code==='ENOENT')return;throw error;}
  const cutoff=Date.now()-this.staleTempMs;
  for(const name of names){if(!/\.json\.[0-9a-f-]{36}\.tmp$/i.test(name))continue;const file=path.join(this.saveDir,name);try{if((await stat(file)).mtimeMs<cutoff)await rm(file,{force:true});}catch(error){if(error.code!=='ENOENT')throw error;}}
 }
 campaignPath(campaignId){if(!validCampaignId(campaignId))throw new Error('INVALID_CAMPAIGN_ID');return path.join(this.saveDir,'.campaigns',campaignId+'.json');}
 async getCampaign(campaignId){try{const data=JSON.parse(await readFile(this.campaignPath(campaignId),'utf8'));if(data.campaignId!==campaignId||!Array.isArray(data.audience)||!data.gift||typeof data.fingerprint!=='string')throw new Error('STORAGE_CAMPAIGN_CORRUPT');return data;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 async registerCampaign(manifest){return this.locked(async()=>{
  const target=this.campaignPath(manifest.campaignId),folder=path.dirname(target),temp=`${target}.${randomUUID()}.tmp`;
  await mkdir(folder,{recursive:true,mode:0o700});
  try{
   const handle=await open(temp,'wx',0o600);
   try{await handle.writeFile(JSON.stringify(manifest),'utf8');await handle.sync();}finally{await handle.close();}
   try{await link(temp,target);}catch(error){if(error.code!=='EEXIST')throw error;}
   await syncDirectory(folder);return this.getCampaign(manifest.campaignId);
  }finally{await rm(temp,{force:true}).catch(()=>{});}
 });}

 pathFor(room){if(!ROOM.test(room))throw new Error('Invalid adventure room name');return path.join(this.saveDir,room+'.json');}
 async readState(room){try{return parseAdventureSave(await readFile(this.pathFor(room),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 async load(room){return this.locked(()=>this.readState(room));}
 async writeState(room,encoded){
  const target=this.pathFor(room),temporary=`${target}.${randomUUID()}.tmp`;
  await mkdir(this.saveDir,{recursive:true});
  try{const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(encoded,'utf8');await handle.sync();}finally{await handle.close();}
   parseAdventureSave(await readFile(temporary,'utf8'));await rename(temporary,target);await syncDirectory(this.saveDir);
  }catch(error){await rm(temporary,{force:true}).catch(()=>{});throw error;}
 }
 async save(room,state){return this.locked(async()=>{const encoded=JSON.stringify(validateState(state));validateState(JSON.parse(encoded));await this.writeState(room,encoded);});}
 savePair(entries,operationId){return this.locked(async()=>{
  let prepared=false;
  try{return await this.pairJournal.commit(entries,operationId,{onPrepared:()=>{prepared=true;}});}
  catch(error){if(prepared){this.staleAfterFailedPair=true;this.queue.needsRecovery=true;}throw error;}
 });}

 async profile(room){const state=await this.load(room);return state?{userId:room,displayName:state.owner||room,avatarUrl:null,createdAt:null,updatedAt:null}:null;}
 async listAccounts({search='',limit=50,offset=0}={}){
  let names=[];try{names=(await readdir(this.saveDir)).filter(name=>name.endsWith('.json')&&!name.endsWith('.tmp')).map(name=>name.slice(0,-5));}catch(error){if(error.code!=='ENOENT')throw error;}
  const query=String(search||'').trim().toLowerCase();if(query)names=names.filter(name=>name.toLowerCase().includes(query));names.sort();
  const total=names.length,selected=names.slice(Math.max(0,offset),Math.max(0,offset)+Math.min(100,Math.max(1,limit))),accounts=[];
  for(const userId of selected){const state=await this.load(userId);accounts.push({userId,displayName:state?.owner||userId,avatarUrl:null,createdAt:null,updatedAt:null,schemaVersion:state?.schemaVersion||null,revision:state?.revision||0,state});}
  return {total,accounts};
 }
 async listAudienceIds({after=null,limit=250,tierId=null}={}){
  const {rankedTierView}=await import('./ranked-tiers.mjs');
  if(after!==null&&(typeof after!=='string'||!ROOM.test(after)))throw new Error('INVALID_AUDIENCE_CURSOR');
  // Source IDs are stable across updatedAt changes. Keep a bounded page of IDs,
  // not 50k full saves; read a state only when a rank predicate is requested.
  const names=await this.locked(async()=>{
   try{return (await readdir(this.saveDir)).filter(name=>ROOM.test(name.slice(0,-5))&&name.endsWith('.json')).map(name=>name.slice(0,-5)).sort();}
   catch(error){if(error.code==='ENOENT')return [];throw error;}
  });
  const ids=[];
  for(const id of names){
   if(after!==null&&id<=after)continue;
   if(tierId){const state=await this.load(id);if(!state||rankedTierView(state.rankedV1?.rating??1000).tierId!==tierId)continue;}
   ids.push(id);if(ids.length>=Math.min(250,Math.max(1,limit)))break;
  }
  return ids;
 }
 async writeBackup(room,state,backupDir,label){
  const safeLabel=String(label).replace(/[^A-Za-z0-9_-]/g,'-');
  if(!safeLabel)throw new Error('Backup label is required');
  const encoded=JSON.stringify(validateState(state)),backupId=randomUUID(),createdAt=new Date(this.now()).toISOString(),folder=path.resolve(backupDir);
  const envelope={version:BACKUP_VERSION,backupId,createdAt,userId:room,checksum:sha(encoded),schemaVersion:state.schemaVersion??1,catalogVersion:state.catalogVersion??state.progressionV3?.catalogVersion??null,state:JSON.parse(encoded)};
  const destination=path.join(folder,`${room}.${safeLabel}.${createdAt.replace(/[:.]/g,'-')}.${backupId}.pvbackup.json`);await durableJsonWrite(destination,JSON.stringify(envelope));await this.pruneBackups(room,folder);return destination;
 }
 async pruneBackups(room,folder){
  const prefix=`${room}.`;let files;try{files=(await readdir(folder)).filter(name=>name.startsWith(prefix)&&name.endsWith('.pvbackup.json')).sort().reverse();}catch(error){if(error.code==='ENOENT')return;throw error;}
  await Promise.all(files.slice(this.backupRetention).map(name=>rm(path.join(folder,name),{force:true})));
 }
 async writeRecoveryCopy(room,raw){
  const folder=path.join(this.saveDir,'.restore-backups'),backupId=randomUUID(),createdAt=new Date(this.now()).toISOString();
  const envelope={version:BACKUP_VERSION,backupId,createdAt,userId:room,checksum:sha(raw),validState:false,rawState:raw};
  const destination=path.join(folder,`${room}.corrupt-pre-restore.${createdAt.replace(/[:.]/g,'-')}.${backupId}.pvrecovery.json`);await durableJsonWrite(destination,JSON.stringify(envelope));return destination;
 }
 async backup(room,backupDir,label){return this.locked(async()=>{const state=parseAdventureSave(await readFile(this.pathFor(room),'utf8'));return this.writeBackup(room,state,backupDir,label);});}
 async restore(room,backupFile){return this.locked(async()=>{
  const source=path.resolve(backupFile),target=this.pathFor(room);
  if(source===target)throw new Error('Restore source must be a separate backup file');
  const parsed=JSON.parse(await readFile(source,'utf8'));let state;
  if(parsed?.version===BACKUP_VERSION&&parsed?.state){if(parsed.userId!==room)throw Object.assign(new Error('Backup belongs to another account'),{code:'STORAGE_RESTORE_ACCOUNT_MISMATCH'});const encoded=JSON.stringify(parsed.state);if(parsed.checksum!==sha(encoded))throw Object.assign(new Error('Backup checksum mismatch'),{code:'STORAGE_BACKUP_CHECKSUM_MISMATCH'});state=validateState(parsed.state);}
  else{if(!path.basename(source).startsWith(`${room}.`))throw Object.assign(new Error('Legacy backup account cannot be verified'),{code:'STORAGE_RESTORE_ACCOUNT_MISMATCH'});state=validateState(parsed);}
  await access(source);let currentRaw=null;try{currentRaw=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(currentRaw!==null){try{await this.writeBackup(room,parseAdventureSave(currentRaw),path.join(this.saveDir,'.restore-backups'),'pre-restore');}catch(error){if(!['STORAGE_SAVE_JSON_CORRUPT','STORAGE_SAVE_SCHEMA_INVALID','STORAGE_SAVE_VERSION_UNSUPPORTED','STORAGE_SAVE_REFERENCE_INVALID'].includes(error.code))throw error;await this.writeRecoveryCopy(room,currentRaw);}}
  await this.writeState(room,JSON.stringify(state));return state;
 });}
}
