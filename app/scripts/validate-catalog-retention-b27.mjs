// B27: pin immutable source snapshots and prove the active-only runtime subset.
import {createHash} from 'node:crypto';
import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeVersion=version=>typeof version==='string'&&/^pv-[a-z0-9-]+$/.test(version)&&!version.includes('..');
const catalogRel=version=>`catalogs/${version}/catalog.json`;
const isMissing=error=>error?.code==='ENOENT';

export async function validateCatalogRetention({root=DEFAULT_APP,mode='source',scanRuntime=true}={}){
 if(!['source','runtime'].includes(mode))throw new Error('Unknown catalog retention mode');
 const base=path.join(root,'content-active');
 const [policy,pointer]=await Promise.all([
  readFile(path.join(base,'retention-manifest.json'),'utf8').then(JSON.parse),
  readFile(path.join(base,'active.json'),'utf8').then(JSON.parse),
 ]);
 if(policy.schemaVersion!==1||policy.policy!=='catalog-retention-b27'||!Array.isArray(policy.catalogs)||!policy.catalogs.length)throw new Error('Invalid catalog retention policy');
 if(pointer.schemaVersion!==1||!safeVersion(pointer.catalogVersion)||pointer.catalogFile!==catalogRel(pointer.catalogVersion)||!/^[a-f0-9]{64}$/.test(pointer.sha256))throw new Error('Invalid active catalog pointer');
 const names=new Set(),listed=new Set();let activeCount=0,historyBytes=0,activeBytes=0;
 for(const entry of policy.catalogs){
  if(!safeVersion(entry.version)||names.has(entry.version)||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0)throw new Error('Invalid/duplicate catalog retention entry');
  names.add(entry.version);
  const isActive=entry.version===pointer.catalogVersion,expected=isActive?'active-runtime':'source-history';
  if(entry.classification!==expected)throw new Error(`Catalog classification stale: ${entry.version}`);
  if(isActive){activeCount++;if(entry.sha256!==pointer.sha256)throw new Error('Active catalog policy/pointer SHA-256 mismatch');activeBytes+=entry.bytes;}
  else historyBytes+=entry.bytes;
  const dir=path.join(base,'catalogs',entry.version),file=path.join(dir,'catalog.json');
  let bytes;
  try{
   const [folderStat,fileStat]=await Promise.all([lstat(dir),lstat(file)]);
   if(!folderStat.isDirectory()||folderStat.isSymbolicLink()||!fileStat.isFile()||fileStat.isSymbolicLink())throw new Error(`Catalog symlink/invalid file: ${entry.version}`);
   bytes=await readFile(file);
  }catch(error){
   if(mode==='runtime'&&!isActive&&isMissing(error))continue;
   throw new Error(`Catalog unavailable or unsafe: ${entry.version}: ${error.message}`,{cause:error});
  }
  if(mode==='runtime'&&!isActive)throw new Error(`Runtime ZIP includes source-only catalog: ${entry.version}`);
  if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error(`Catalog snapshot integrity mismatch: ${entry.version}`);
  const metadata=JSON.parse(bytes.toString('utf8'))?.metadata;
  if(metadata?.schemaVersion!==3||metadata?.catalogVersion!==entry.version)throw new Error(`Catalog metadata mismatch: ${entry.version}`);
  listed.add(entry.version);
 }
 if(activeCount!==1)throw new Error('Exactly one active-runtime catalog is required');
 const actual=await readdir(path.join(base,'catalogs'),{withFileTypes:true});
 for(const entry of actual){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!names.has(entry.name))throw new Error(`Unknown or unsafe catalog directory: ${entry.name}`);
  const items=await readdir(path.join(base,'catalogs',entry.name));
  if(items.length!==1||items[0]!=='catalog.json')throw new Error(`Unexpected catalog payload: ${entry.name}`);
 }
 if(mode==='source'&&listed.size!==names.size)throw new Error('Source archive is missing pinned history');
 if(mode==='runtime'&&(actual.length!==1||!listed.has(pointer.catalogVersion)))throw new Error('Runtime catalog set must be active-only');
 if(scanRuntime){
  const paths=['local-server.mjs'];
  async function gather(dir){for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){
   const rel=`${dir}/${item.name}`;
   if(item.isSymbolicLink())throw new Error(`Runtime source symlink: ${rel}`);
   if(item.isDirectory())await gather(rel);
   else if(/\.(?:js|mjs)$/.test(item.name))paths.push(rel);
  }}
  await gather('server');await gather('public/js');
  for(const rel of paths){const body=await readFile(path.join(root,rel),'utf8');
   // A literal historical catalog ID in runtime would invalidate the active-only delivery contract.
   for(const entry of policy.catalogs)if(entry.classification==='source-history'&&body.includes(entry.version))throw new Error(`Runtime source references source-history catalog: ${rel}: ${entry.version}`);
   if(/content-active\/catalogs\//.test(body))throw new Error(`Runtime source hardcodes catalog folder: ${rel}`);
  }
 }
 return {mode,activeVersion:pointer.catalogVersion,activeBytes,historyBytes,totalBytes:activeBytes+historyBytes,sourceCatalogs:policy.catalogs.length,runtimeCatalogs:1};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let mode=process.argv.includes('--runtime')?'runtime':'source';
 if(mode==='source'){try{const release=JSON.parse(await readFile(path.join(DEFAULT_APP,'..','RELEASE-MANIFEST.json'),'utf8'));if(release.kind==='runtime')mode='runtime';}catch(error){if(error?.code!=='ENOENT')throw error;}}
 try{const result=await validateCatalogRetention({mode});
  if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
  else console.log(`Catalog retention B27 OK: ${result.sourceCatalogs} pinned source snapshots, ${result.runtimeCatalogs} active runtime catalog, ${(result.historyBytes/1048576).toFixed(2)} MiB historical source-only.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
