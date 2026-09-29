import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';

const VERSION=1,MAX_ENTRIES=100_000;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sidHash=sid=>createHash('sha256').update(String(sid)).digest('hex');

export class FileSessionRevocationStore{
 constructor({filePath,now=()=>Date.now(),lockTimeoutMs=5000,staleLockMs=30_000}={}){
  if(!filePath)throw new TypeError('Session revocation file path is required');
  this.filePath=path.resolve(filePath);this.lockPath=this.filePath+'.lock';this.now=now;
  this.lockTimeoutMs=lockTimeoutMs;this.staleLockMs=staleLockMs;
 }
 async read(){
  try{
   const data=JSON.parse(await readFile(this.filePath,'utf8'));
   if(data?.version!==VERSION||!data.entries||typeof data.entries!=='object'||Array.isArray(data.entries))throw new Error('SESSION_REVOCATION_STORE_CORRUPT');
   return data;
  }catch(error){if(error.code==='ENOENT')return {version:VERSION,entries:{}};throw error;}
 }
 async isRevoked(session){
  const expiry=(await this.read()).entries[sidHash(session?.sid)];
  return Number.isSafeInteger(expiry)&&expiry>Math.floor(this.now()/1000);
 }
 async acquire(){
  await mkdir(path.dirname(this.filePath),{recursive:true,mode:0o700});const started=Date.now();
  while(Date.now()-started<=this.lockTimeoutMs){
   try{const handle=await open(this.lockPath,'wx',0o600);await handle.writeFile(`${process.pid}\n${Date.now()}\n`);return handle;}
   catch(error){
    if(error.code!=='EEXIST')throw error;
    try{const info=await stat(this.lockPath);if(Date.now()-info.mtimeMs>this.staleLockMs){await rm(this.lockPath,{force:true});continue;}}catch(check){if(check.code!=='ENOENT')throw check;}
    await wait(10);
   }
  }
  throw Object.assign(new Error('Session revocation lock timeout'),{code:'SESSION_REVOCATION_LOCK_TIMEOUT'});
 }
 async revoke(session){
  if(typeof session?.sid!=='string'||!Number.isSafeInteger(session.exp))throw new TypeError('Invalid session revocation');
  const lock=await this.acquire(),temporary=`${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
  try{
   const data=await this.read(),nowSeconds=Math.floor(this.now()/1000);
   for(const [key,expiry] of Object.entries(data.entries))if(!Number.isSafeInteger(expiry)||expiry<=nowSeconds)delete data.entries[key];
   data.entries[sidHash(session.sid)]=session.exp;
   if(Object.keys(data.entries).length>MAX_ENTRIES)throw Object.assign(new Error('Session revocation store capacity exceeded'),{code:'SESSION_REVOCATION_CAPACITY'});
   const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(JSON.stringify(data));await handle.sync();}finally{await handle.close();}
   await rename(temporary,this.filePath);return true;
  }finally{await rm(temporary,{force:true}).catch(()=>{});await lock.close().catch(()=>{});await rm(this.lockPath,{force:true}).catch(()=>{});}
 }
}

export {sidHash};
