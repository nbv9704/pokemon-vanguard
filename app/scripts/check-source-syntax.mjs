import {readFileSync,readdirSync} from 'node:fs';
import {extname,join} from 'node:path';
import {SourceTextModule} from 'node:vm';

// Parse, do not execute. One process for all source modules avoids ~380 Node startups.
// Invoked with Node 22 --experimental-vm-modules; fail rather than silently skip.
if(typeof SourceTextModule!=='function'){
 console.error('SourceTextModule unavailable; run this checker with Node 22 --experimental-vm-modules.');
 process.exit(1);
}
const roots=['mechanics-v3','rules-v3','server','content-import','content-src','scripts','public/js'];
const rootFiles=['local-server.mjs','public/client.js','public/battle-animation.js'];
function sourceFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=join(directory,entry.name);
  if(entry.isDirectory())return sourceFiles(file);
  return ['.js','.mjs'].includes(extname(entry.name))?[file]:[];
 });
}
const files=[...roots.flatMap(sourceFiles),...rootFiles].sort();
for(const file of files){
 try{new SourceTextModule(readFileSync(file,'utf8'),{identifier:file});}
 catch(error){console.error(`Syntax error in ${file}:\n${error.stack||error}`);process.exit(1);}
}
console.log(`source syntax OK — ${files.length} files (one-process module parser)`);
