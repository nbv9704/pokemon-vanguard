import {createHash} from 'node:crypto';
import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {durableJsonWrite} from './json-pair-journal.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const SEGMENT_SIZE=256,caches=new Map();
const collectionId=collection=>`${String(collection).replace(/[^A-Za-z0-9_-]/g,'-').slice(0,48)}-${sha(collection).slice(0,12)}`;
const folderFor=(saveDir,userId,collection)=>path.join(saveDir,'.hot-archive',userId,collectionId(collection));
const manifestPath=folder=>path.join(folder,'manifest.json');
const segmentPath=(folder,id)=>path.join(folder,`${String(id).padStart(8,'0')}.json`);
const identity=(collection,key)=>`${collection}\0${key}`;
const validate=(record,collection,key)=>{
 if(record?.version!==1||record.collection!==collection||record.key!==key||record.entry===undefined)throw Object.assign(new Error('Hot archive record is corrupt'),{code:'HOT_ARCHIVE_CORRUPT'});
 return record;
};
async function maybeRead(file){try{return await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function parseManifest(raw){
 if(raw===null)return {version:1,generation:0,count:0,segments:[]};let value;try{value=JSON.parse(raw);}catch{throw Object.assign(new Error('Hot archive manifest is corrupt'),{code:'HOT_ARCHIVE_CORRUPT'});}
 if(value?.version!==1||!Number.isSafeInteger(value.generation)||!Number.isSafeInteger(value.count)||!Array.isArray(value.segments)||value.segments.some(row=>!Number.isSafeInteger(row.id)||!Number.isSafeInteger(row.count)||row.count<1||row.count>SEGMENT_SIZE))throw Object.assign(new Error('Hot archive manifest is corrupt'),{code:'HOT_ARCHIVE_CORRUPT'});return value;
}
async function loadCollection(saveDir,userId,collection){
 const folder=folderFor(saveDir,userId,collection),manifest=parseManifest(await maybeRead(manifestPath(folder))),cacheKey=folder,cached=caches.get(cacheKey);
 if(cached?.generation===manifest.generation&&cached.count===manifest.count)return {...cached,folder,manifest,cacheKey};
 const values=new Map();let total=0,last=[];
 for(const segment of manifest.segments){let rows;try{rows=JSON.parse(await readFile(segmentPath(folder,segment.id),'utf8'));}catch{throw Object.assign(new Error('Hot archive segment is corrupt'),{code:'HOT_ARCHIVE_CORRUPT'});}
  if(!Array.isArray(rows)||rows.length!==segment.count)throw Object.assign(new Error('Hot archive segment is corrupt'),{code:'HOT_ARCHIVE_CORRUPT'});
  for(const row of rows){validate(row,collection,row?.key);const id=identity(collection,row.key),previous=values.get(id);if(previous&&!same(previous.entry,row.entry))throw Object.assign(new Error('Hot archive key conflict'),{code:'HOT_ARCHIVE_KEY_CONFLICT'});values.set(id,row);}
  total+=rows.length;last=rows;
 }
 if(total!==manifest.count)throw Object.assign(new Error('Hot archive count mismatch'),{code:'HOT_ARCHIVE_CORRUPT'});
 const loaded={generation:manifest.generation,count:manifest.count,values,last};caches.set(cacheKey,loaded);return {...loaded,folder,manifest,cacheKey};
}

export async function readJsonHotArchive(saveDir,userId,collection,key){return (await loadCollection(saveDir,userId,collection)).values.get(identity(collection,key))||null;}

export async function writeJsonHotArchive(saveDir,userId,records){
 const groups=new Map();for(const record of records){if(!groups.has(record.collection))groups.set(record.collection,[]);groups.get(record.collection).push(record);}
 for(const [collection,sources] of groups){const loaded=await loadCollection(saveDir,userId,collection),values=new Map(loaded.values),missing=[];
  for(const source of sources){const record={version:1,collection,key:source.key,entry:source.entry},id=identity(collection,source.key),previous=values.get(id);if(previous){if(!same(previous.entry,record.entry))throw Object.assign(new Error('Hot archive key conflict'),{code:'HOT_ARCHIVE_KEY_CONFLICT'});continue;}values.set(id,record);missing.push(record);}
  if(!missing.length)continue;
  const segments=loaded.manifest.segments.map(row=>({...row}));let nextId=segments.at(-1)?.id??0,last=[],replacedId=null;
  if(segments.length&&loaded.last.length<SEGMENT_SIZE){replacedId=segments.pop().id;last=loaded.last.slice();}
  while(missing.length){if(!last.length||last.length===SEGMENT_SIZE){last=[];}const take=missing.splice(0,SEGMENT_SIZE-last.length);last.push(...take);nextId++;segments.push({id:nextId,count:last.length});await durableJsonWrite(segmentPath(loaded.folder,nextId),JSON.stringify(last));if(missing.length)last=[];}
  const manifest={version:1,generation:loaded.manifest.generation+1,count:values.size,segments};await durableJsonWrite(manifestPath(loaded.folder),JSON.stringify(manifest));if(replacedId!==null)await rm(segmentPath(loaded.folder,replacedId),{force:true}).catch(()=>{});caches.set(loaded.cacheKey,{generation:manifest.generation,count:manifest.count,values,last});
 }
}

const archiveId=(collection,key)=>sha(`${collection}\0${key}`);
export function supabaseHotArchiveLabel(collection,key){return `hot-v1:${collection}:${archiveId(collection,key)}`;}
export function validateSupabaseHotArchive(row,collection,key){return validate(row?.state,collection,key);}
