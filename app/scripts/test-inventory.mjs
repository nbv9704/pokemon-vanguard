// Deterministic recursive discovery; legacy .test.ts files are listed, not silently run.
import {readdir} from 'node:fs/promises';
import path from 'node:path';
const EXCLUDED=new Set(['node_modules','.git','fixtures','__fixtures__','archive','dist']);
export async function discoverTests(root){
 const runnable=[],archived=[];
 async function walk(dir){
  for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   if(item.isSymbolicLink())continue;
   const full=path.join(dir,item.name);
   if(item.isDirectory()){if(!EXCLUDED.has(item.name))await walk(full);continue;}
   if(item.name.endsWith('.test.mjs'))runnable.push(path.relative(root,full).replaceAll('\\','/'));
   if(item.name.endsWith('.test.ts'))archived.push(path.relative(root,full).replaceAll('\\','/'));
  }
 }
 await walk(path.join(root,'tests'));
 runnable.sort();archived.sort();return {runnable,archived,archiveReason:'Original cloud/Durable Object tests require the retired cloud harness; npm test uses supported Node .test.mjs only.'};
}
