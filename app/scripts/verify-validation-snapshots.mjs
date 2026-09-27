import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function verifyValidationSnapshots(root){
 const manifest=JSON.parse(await readFile(path.join(root,'snapshot-manifest.json'),'utf8'));
 if(manifest.schemaVersion!==1)throw new Error('Unsupported validation snapshot manifest');
 const expected=Object.entries(manifest.files||{});
 if(!expected.length)throw new Error('Validation snapshot manifest is empty');
 for(const [name,digest] of expected){
  if(!/^[a-z0-9/-]+\.json$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw new Error(`Invalid snapshot manifest entry: ${name}`);
  const data=await readFile(path.join(root,name));
  if(createHash('sha256').update(data).digest('hex')!==digest)throw new Error(`Validation snapshot has changed: ${name}`);
 }
 const onDisk=[];
 async function walk(folder,relative=''){
  for(const entry of await readdir(folder,{withFileTypes:true})){
   if(entry.isSymbolicLink())throw new Error(`Unexpected symlink in validation snapshots: ${entry.name}`);
   const name=path.posix.join(relative,entry.name);
   if(entry.isDirectory())await walk(path.join(folder,entry.name),name);
   else if(name.endsWith('.json')&&name!=='snapshot-manifest.json')onDisk.push(name);
  }
 }
 await walk(root);
 const wanted=new Set(expected.map(([name])=>name));
 if(onDisk.some(name=>!wanted.has(name))||onDisk.length!==expected.length)throw new Error('Validation snapshot file set differs from manifest');
 return expected.length;
}
const self=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self){
 const root=fileURLToPath(new URL('../content-validation/',import.meta.url));
 try{console.log(`validation snapshots OK — ${await verifyValidationSnapshots(root)} hashed JSON files`);}catch(error){console.error(error.message);process.exitCode=1;}
}
