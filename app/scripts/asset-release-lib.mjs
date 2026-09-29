import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha256=body=>createHash('sha256').update(body).digest('hex');
const releasePattern=/^sha256-[a-f0-9]{64}$/;
const bucketPattern=/^[a-z0-9][a-z0-9_-]{1,62}$/;
const encodePath=value=>value.split('/').map(encodeURIComponent).join('/');
const within=(root,candidate)=>{const relative=path.relative(root,candidate);return relative&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};

export function normalizeSupabaseUrl(value,{allowLocal=false}={}){
 const url=new URL(String(value||''));
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('SUPABASE_URL must be an origin without credentials or a path');
 if(url.protocol!=='https:'&&!(allowLocal&&url.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(url.hostname)))throw new Error('SUPABASE_URL must use HTTPS');
 return url.origin;
}
export function validateBucketName(value){const bucket=String(value||'');if(!bucketPattern.test(bucket))throw new Error('PV_ASSET_BUCKET must contain 2-63 lowercase letters, numbers, hyphens, or underscores');return bucket;}
export function assetReleaseLocations({supabaseUrl,bucket,release,allowLocal=false}){
 const origin=normalizeSupabaseUrl(supabaseUrl,{allowLocal}),safeBucket=validateBucketName(bucket);if(!releasePattern.test(release))throw new Error('Invalid immutable asset release');
 const prefix=`releases/${release}`,encodedBucket=encodeURIComponent(safeBucket),encodedPrefix=encodePath(prefix);
 return {prefix,uploadBase:`${origin}/storage/v1/object/${encodedBucket}/${encodedPrefix}`,publicBase:`${origin}/storage/v1/object/public/${encodedBucket}/${encodedPrefix}`,bucketUrl:`${origin}/storage/v1/bucket/${encodedBucket}`};
}
function validateEntry(entry){
 if(!entry||typeof entry.path!=='string'||!entry.path.startsWith('/')||entry.path.includes('\\')||entry.path.split('/').includes('..'))throw new Error('Asset manifest contains an unsafe path');
 if(!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||typeof entry.mime!=='string')throw new Error(`Asset manifest metadata is invalid for ${entry.path}`);
}
export async function readLocalAssetRelease({publicDir=path.join(appRoot,'public')}={}){
 const root=path.resolve(publicDir),manifestPath=path.join(root,'asset-manifest.json'),manifestBody=await readFile(manifestPath),manifest=JSON.parse(manifestBody);
 if(manifest.schemaVersion!==1||!releasePattern.test(manifest.release)||!Array.isArray(manifest.entries))throw new Error('Runtime asset manifest is invalid');
 const computedRelease='sha256-'+sha256(Buffer.from(manifest.entries.map(entry=>`${entry.path}\0${entry.sha256}\0${entry.bytes}`).join('\n')));if(manifest.release!==computedRelease)throw new Error('Runtime asset release hash is stale');
 const objects=[];let bytes=0;
 for(const entry of manifest.entries){validateEntry(entry);const absolute=path.resolve(root,'.'+entry.path);if(!within(root,absolute))throw new Error(`Asset escapes public root: ${entry.path}`);const body=await readFile(absolute);if(body.length!==entry.bytes||sha256(body)!==entry.sha256)throw new Error(`Local asset does not match manifest: ${entry.path}`);objects.push({...entry,absolute,objectPath:entry.path.slice(1)});bytes+=body.length;}
 if(objects.length!==manifest.totals?.files||bytes!==manifest.totals?.bytes)throw new Error('Runtime asset manifest totals are stale');
 objects.push({path:'/asset-manifest.json',objectPath:'asset-manifest.json',absolute:manifestPath,bytes:manifestBody.length,sha256:sha256(manifestBody),mime:'application/json'});
 return {manifest,objects,release:manifest.release,files:objects.length,bytes:bytes+manifestBody.length};
}
async function mapConcurrent(items,limit,work){let cursor=0;const workers=Array.from({length:Math.min(items.length,Math.max(1,limit))},async()=>{while(cursor<items.length){const index=cursor++;await work(items[index],index);}});await Promise.all(workers);}
async function request(fetchImpl,url,options,timeoutMs){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetchImpl(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
async function remoteDigest(response,object){if(!response.ok)throw new Error(`Remote asset unavailable (${response.status}): ${object.path}`);const contentLength=Number(response.headers?.get?.('content-length'));if(Number.isFinite(contentLength)&&contentLength!==object.bytes)throw new Error(`Remote asset length mismatch: ${object.path}`);const body=Buffer.from(await response.arrayBuffer());if(body.length!==object.bytes||sha256(body)!==object.sha256)throw new Error(`Remote asset hash mismatch: ${object.path}`);}
export async function verifyRemoteAssetRelease({release,supabaseUrl,bucket,fetchImpl=fetch,concurrency=6,timeoutMs=30_000,onProgress=()=>{},allowLocal=false}){
 const locations=assetReleaseLocations({supabaseUrl,bucket,release:release.release,allowLocal});let completed=0;
 await mapConcurrent(release.objects,concurrency,async object=>{const url=`${locations.publicBase}/${encodePath(object.objectPath)}`,response=await request(fetchImpl,url,{headers:{Accept:object.mime},cache:'no-store'},timeoutMs);await remoteDigest(response,object);onProgress({stage:'verify',completed:++completed,total:release.objects.length,path:object.path});});
 return {...locations,files:release.objects.length,bytes:release.bytes};
}
export async function deploySupabaseAssetRelease({release,supabaseUrl,bucket,secretKey,fetchImpl=fetch,concurrency=6,timeoutMs=30_000,onProgress=()=>{},allowLocal=false}){
 if(!String(secretKey||'').trim())throw new Error('SUPABASE_SECRET_KEY is required for upload and must remain server-side');
 const locations=assetReleaseLocations({supabaseUrl,bucket,release:release.release,allowLocal}),auth={Authorization:`Bearer ${secretKey}`,apikey:secretKey};
 const bucketResponse=await request(fetchImpl,locations.bucketUrl,{headers:{...auth,Accept:'application/json'}},timeoutMs);if(!bucketResponse.ok)throw new Error(`Asset bucket is unavailable (${bucketResponse.status}); create it as a public bucket first`);const bucketInfo=await bucketResponse.json();if(bucketInfo.public!==true)throw new Error('Asset bucket must be public before deployment');
 let completed=0;const upload=async object=>{const body=await readFile(object.absolute),url=`${locations.uploadBase}/${encodePath(object.objectPath)}`,response=await request(fetchImpl,url,{method:'POST',headers:{...auth,'Content-Type':object.mime,'Cache-Control':'max-age=31536000','x-upsert':'false'},body},timeoutMs);if(!response.ok){if(![400,409].includes(response.status))throw new Error(`Asset upload failed (${response.status}): ${object.path}`);const existing=await request(fetchImpl,`${locations.publicBase}/${encodePath(object.objectPath)}`,{cache:'no-store'},timeoutMs);await remoteDigest(existing,object);}onProgress({stage:'upload',completed:++completed,total:release.objects.length,path:object.path});};
 const content=release.objects.filter(object=>object.path!=='/asset-manifest.json'),pointer=release.objects.find(object=>object.path==='/asset-manifest.json');await mapConcurrent(content,concurrency,upload);await upload(pointer);
 return verifyRemoteAssetRelease({release,supabaseUrl,bucket,fetchImpl,concurrency,timeoutMs,onProgress,allowLocal});
}
