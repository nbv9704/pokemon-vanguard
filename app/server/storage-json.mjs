import {readFile,mkdir,rename,copyFile,access,readdir,rm,open,link} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {validCampaignId} from './admin-campaigns.mjs';
import {JsonPairJournal} from './json-pair-journal.mjs';

// A sync of the containing directory makes completed renames more durable on
// POSIX filesystems. Windows does not expose equivalent directory fsync here.
async function syncDirectory(folder){
 if(process.platform==='win32')return;
 const handle=await open(folder,'r');try{await handle.sync();}finally{await handle.close();}
}
import path from 'node:path';

const ROOM=/^[A-Za-z0-9_-]{1,64}$/;
function validateState(state){
 if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid adventure save root');
 if(state.schemaVersion!==undefined&&(!Number.isInteger(state.schemaVersion)||state.schemaVersion<1||state.schemaVersion>3))throw new Error(`Unsupported adventure save schema: ${state.schemaVersion}`);
 if(state.wallet!==undefined){if(!state.wallet||typeof state.wallet!=='object'||Array.isArray(state.wallet))throw new Error('Invalid adventure wallet');for(const key of ['coins','crystals','recruitmentTickets'])if(state.wallet[key]!==undefined&&(!Number.isSafeInteger(state.wallet[key])||state.wallet[key]<0))throw new Error(`Invalid adventure wallet balance: ${key}`);}
 return state;
}
// One in-process IO queue per save directory serializes local readers/writers,
// including multiple adapter instances. Separate Node processes are unsupported.
const queues=new Map();
export class JsonAdventureStorage{
 constructor(saveDir){
  this.saveDir=path.resolve(saveDir);this.staleAfterFailedPair=false;this.ready=false;
  if(!queues.has(this.saveDir))queues.set(this.saveDir,{tail:Promise.resolve(),ready:false,needsRecovery:false});
  this.queue=queues.get(this.saveDir);
  this.pairJournal=new JsonPairJournal(this.saveDir,{validateState,writeState:(room,text)=>this.writeState(room,text)});
 }
 async locked(work){
  const q=this.queue,job=q.tail.then(async()=>{
   if(this.staleAfterFailedPair)throw Object.assign(new Error('Local pair write failed; restart server and reload both accounts before more operations'),{code:'STORAGE_PAIR_RESTART_REQUIRED'});
   if(!this.ready||q.needsRecovery){try{await this.pairJournal.recover();this.ready=true;q.needsRecovery=false;}catch(error){q.needsRecovery=true;throw error;}}
   return work();
  });q.tail=job.catch(()=>{});return job;
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
 async readState(room){try{return validateState(JSON.parse(await readFile(this.pathFor(room),'utf8')));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 async load(room){return this.locked(()=>this.readState(room));}
 async writeState(room,encoded){
  const target=this.pathFor(room),temporary=`${target}.${randomUUID()}.tmp`;
  await mkdir(this.saveDir,{recursive:true});
  try{const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(encoded,'utf8');await handle.sync();}finally{await handle.close();}
   validateState(JSON.parse(await readFile(temporary,'utf8')));await rename(temporary,target);await syncDirectory(this.saveDir);
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
 async backup(room,backupDir,label){return this.locked(async()=>{
  const source=this.pathFor(room);validateState(JSON.parse(await readFile(source,'utf8')));
  const safeLabel=String(label).replace(/[^A-Za-z0-9_-]/g,'-');
  if(!safeLabel)throw new Error('Backup label is required');
  const destination=path.join(path.resolve(backupDir),`${room}.${safeLabel}.${randomUUID()}.json`);
  await mkdir(path.dirname(destination),{recursive:true});await copyFile(source,destination);
  validateState(JSON.parse(await readFile(destination,'utf8')));return destination;
 });}
 async restore(room,backupFile){return this.locked(async()=>{
  const source=path.resolve(backupFile),target=this.pathFor(room);
  if(source===target)throw new Error('Restore source must be a separate backup file');
  const state=validateState(JSON.parse(await readFile(source,'utf8')));
  await access(source);await this.writeState(room,JSON.stringify(state));return state;
 });}
}
