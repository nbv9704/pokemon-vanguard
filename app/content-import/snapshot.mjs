import {createHash} from 'node:crypto';
import {access,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';

const SNAPSHOT_ID=/^[a-z0-9][a-z0-9._-]{2,79}$/;
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export async function loadSourceConfig(appRoot){
 return JSON.parse(await readFile(path.join(appRoot,'content-src','pokemon-sources.json'),'utf8'));
}

export async function fetchSnapshot({appRoot,snapshotId,fetchFn=fetch,now=()=>new Date()}){
 if(!SNAPSHOT_ID.test(snapshotId))throw new Error('snapshot ID must be 3-80 lowercase URL-safe characters');
 const config=await loadSourceConfig(appRoot);
 const candidateRoot=path.join(appRoot,'content-candidates',snapshotId);
 const tempRoot=`${candidateRoot}.tmp-${process.pid}`;
 await access(candidateRoot).then(()=>{throw new Error(`snapshot already exists: ${snapshotId}`);},()=>{});
 await mkdir(path.join(tempRoot,'raw'),{recursive:true});
 const sources=[];
 try{
  for(const [key,url] of Object.entries(config.sources)){
   const response=await fetchFn(url,{headers:{'user-agent':'Pokemon-Vanguard-content-import/1'}});
   if(!response.ok)throw new Error(`${key} returned HTTP ${response.status}`);
   const body=Buffer.from(await response.arrayBuffer());
   const filename=`${key}.html`;
   await writeFile(path.join(tempRoot,'raw',filename),body);
   sources.push({key,url,status:response.status,bytes:body.length,sha256:sha256(body),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),filename:`raw/${filename}`});
  }
  const manifest={schemaVersion:1,snapshotId,targetGame:config.targetGame,initialRegulation:config.initialRegulation,fetchedAt:now().toISOString(),parserVersion:1,sources};
  await writeFile(path.join(tempRoot,'fetch-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await rename(tempRoot,candidateRoot);
  return {candidateRoot,manifest};
 }catch(error){await rm(tempRoot,{recursive:true,force:true});throw error;}
}
