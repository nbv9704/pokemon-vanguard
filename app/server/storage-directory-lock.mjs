import {mkdir,readFile,rename,rm,stat,utimes,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class StorageDirectoryLock{
 constructor(saveDir,{timeoutMs=10_000,staleMs=120_000,pollMs=15}={}){this.saveDir=path.resolve(saveDir);this.lockDir=path.join(this.saveDir,'.storage.lock');this.timeoutMs=timeoutMs;this.staleMs=staleMs;this.pollMs=pollMs;}
 async acquire(){
  await mkdir(this.saveDir,{recursive:true,mode:0o700});const started=Date.now();
  while(Date.now()-started<=this.timeoutMs){
   const token=randomUUID();let created=false;
   try{
    await mkdir(this.lockDir,{mode:0o700});created=true;await writeFile(path.join(this.lockDir,'owner.json'),JSON.stringify({version:1,token,pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
    const heartbeat=setInterval(()=>{const now=new Date();void utimes(this.lockDir,now,now).catch(()=>{});},Math.max(10,Math.floor(this.staleMs/3)));heartbeat.unref?.();
    return async()=>{clearInterval(heartbeat);try{const owner=JSON.parse(await readFile(path.join(this.lockDir,'owner.json'),'utf8'));if(owner.token===token)await rm(this.lockDir,{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')throw error;}};
   }catch(error){
    if(error.code!=='EEXIST'){if(created)await rm(this.lockDir,{recursive:true,force:true}).catch(()=>{});throw error;}
    try{const info=await stat(this.lockDir);if(Date.now()-info.mtimeMs>this.staleMs){const tombstone=`${this.lockDir}.stale.${randomUUID()}`;try{await rename(this.lockDir,tombstone);await rm(tombstone,{recursive:true,force:true});continue;}catch(move){if(!['ENOENT','EACCES','EPERM'].includes(move.code))throw move;}}}catch(check){if(check.code!=='ENOENT')throw check;}
    await wait(this.pollMs);
   }
  }
  throw Object.assign(new Error('Local storage lock timeout'),{code:'STORAGE_DIRECTORY_LOCK_TIMEOUT'});
 }
}
