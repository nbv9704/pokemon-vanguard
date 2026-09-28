import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnPython} from '../scripts/python-executable.mjs';
import {validateCatalogRetention} from '../scripts/validate-catalog-retention-b27.mjs';

const APP=fileURLToPath(new URL('../',import.meta.url));
const PACK=fileURLToPath(new URL('../scripts/package-full.py',import.meta.url));
const VERIFY=fileURLToPath(new URL('../scripts/verify-release.py',import.meta.url));
const digest=data=>createHash('sha256').update(data).digest('hex');
const packaged=await readFile(path.join(APP,'..','RELEASE-MANIFEST.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const realMode=packaged?.kind==='runtime'?'runtime':'source';
const run=(script,args)=>spawnPython(script,args,{encoding:'utf8'});
const versionA='pv-fixture-v1',versionB='pv-fixture-v2';
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'pv-b27-retention-')),root=path.join(dir,'repo'),app=path.join(root,'app'),base=path.join(app,'content-active');
 await mkdir(base,{recursive:true});
 await writeFile(path.join(app,'package.json'),'{}\n');await writeFile(path.join(app,'.dev.vars.example'),'SESSION=fixture\n');
 const rows=[];
 for(const version of [versionA,versionB]){
  const payload=Buffer.from(JSON.stringify({metadata:{schemaVersion:3,catalogVersion:version},species:[],moves:[]})+'\n');
  const folder=path.join(base,'catalogs',version);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'catalog.json'),payload);
  rows.push({version,sha256:digest(payload),bytes:payload.length,classification:version===versionB?'active-runtime':'source-history'});
 }
 await writeFile(path.join(base,'active.json'),JSON.stringify({schemaVersion:1,catalogVersion:versionB,catalogFile:`catalogs/${versionB}/catalog.json`,sha256:rows[1].sha256})+'\n');
 await writeFile(path.join(base,'retention-manifest.json'),JSON.stringify({schemaVersion:1,policy:'catalog-retention-b27',catalogs:rows})+'\n');
 return {dir,root,app,base,rows};
}
test('real B27 inventory pins all source versions and proves active-only loader',async()=>{
 const inventory=await validateCatalogRetention({root:APP,mode:realMode});
 assert.equal(inventory.sourceCatalogs,35);assert.equal(inventory.runtimeCatalogs,1);
 assert.ok(inventory.historyBytes>16_000_000);assert.ok(inventory.activeBytes>1_000_000);
});
test('catalog retention rejects edits to historical content, active pointer, and unreviewed version',async()=>{
 const f=await fixture();try{
  assert.equal((await validateCatalogRetention({root:f.app,scanRuntime:false})).sourceCatalogs,2);
  const history=path.join(f.base,'catalogs',versionA,'catalog.json'),original=await readFile(history);
  await writeFile(history,Buffer.concat([original,Buffer.from(' ')]));
  await assert.rejects(validateCatalogRetention({root:f.app,scanRuntime:false}),/integrity mismatch/);
  await writeFile(history,original);
  const pointer=path.join(f.base,'active.json'),body=JSON.parse(await readFile(pointer,'utf8'));
  await writeFile(pointer,JSON.stringify({...body,sha256:'a'.repeat(64)}));
  await assert.rejects(validateCatalogRetention({root:f.app,scanRuntime:false}),/pointer SHA-256 mismatch/);
  await writeFile(pointer,JSON.stringify(body));
  await mkdir(path.join(f.base,'catalogs','pv-unknown-version'));
  await assert.rejects(validateCatalogRetention({root:f.app,scanRuntime:false}),/Unknown or unsafe catalog directory/);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('active-only catalog folder passes only in runtime mode; runtime rejects retained history',async()=>{
 const f=await fixture();try{
  await assert.rejects(validateCatalogRetention({root:f.app,mode:'runtime',scanRuntime:false}),/includes source-only catalog/);
  await rm(path.join(f.base,'catalogs',versionA),{recursive:true});
  assert.equal((await validateCatalogRetention({root:f.app,mode:'runtime',scanRuntime:false})).runtimeCatalogs,1);
  await assert.rejects(validateCatalogRetention({root:f.app,scanRuntime:false}),/unavailable or unsafe/);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('source/runtime fixture ZIPs preserve policy/hash, exclude only historical runtime catalog, and reject tampering',async()=>{
 const f=await fixture();try{
  const src=path.join(f.dir,'source.zip'),slim=path.join(f.dir,'runtime.zip');
  for(const [profile,dest] of [['source',src],['runtime',slim]]){
   const result=run(PACK,['--project-root',f.root,'--profile',profile,'--output',dest]);
   assert.equal(result.status,0,result.stderr||result.stdout);
   const check=run(VERIFY,[dest]);assert.equal(check.status,0,check.stderr||check.stdout);
  }
  const inspect=run('-c',['import sys,zipfile,json; a=zipfile.ZipFile(sys.argv[1]); b=zipfile.ZipFile(sys.argv[2]); x="PokemonVanguard/app/content-active/catalogs/"; print(json.dumps({"source":sorted(n for n in a.namelist() if n.startswith(x)),"runtime":sorted(n for n in b.namelist() if n.startswith(x)),"kind":json.loads(b.read("PokemonVanguard/RELEASE-MANIFEST.json"))["kind"]}))',src,slim]);
  assert.equal(inspect.status,0,inspect.stderr);const rows=JSON.parse(inspect.stdout);
  assert.deepEqual(rows.source.map(x=>x.split('/').at(-2)),[versionA,versionB]);
  assert.deepEqual(rows.runtime.map(x=>x.split('/').at(-2)),[versionB]);assert.equal(rows.kind,'runtime');
  // Even the package entrypoint itself must refuse an altered snapshot.
  await writeFile(path.join(f.base,'catalogs',versionA,'catalog.json'),'{}\n');
  const broken=run(PACK,['--project-root',f.root,'--profile','runtime','--output',path.join(f.dir,'broken.zip')]);
  assert.notEqual(broken.status,0);assert.match(broken.stderr,/Pinned catalog changed/);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('source policy contains only reviewed catalog directories and excludes cache/candidates',async()=>{
 const data=JSON.parse(await readFile(path.join(APP,'content-active','retention-manifest.json'),'utf8'));
 assert.equal(data.catalogs.filter(entry=>entry.classification==='active-runtime').length,1);
 assert.equal(data.catalogs.filter(entry=>entry.classification==='source-history').length,34);
 const names=await readdir(path.join(APP,'content-active','catalogs'));
 assert.deepEqual(names.sort(),data.catalogs.filter(entry=>realMode==='source'||entry.classification==='active-runtime').map(entry=>entry.version).sort());
});
