import {readdirSync} from 'node:fs';
import {extname,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const roots=['mechanics-v3','rules-v3','server','content-import','content-src','scripts','public/js'];
const rootFiles=['local-server.mjs','public/client.js','public/battle-animation.js'];

function sourceFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const path=join(directory,entry.name);
  if(entry.isDirectory())return sourceFiles(path);
  return ['.js','.mjs'].includes(extname(entry.name))?[path]:[];
 });
}

const files=[...roots.flatMap(sourceFiles),...rootFiles].sort();
for(const file of files){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(result.status===0)continue;
 process.stderr.write(result.stderr||result.stdout||`Syntax check failed: ${file}\n`);
 process.exit(result.status||1);
}

console.log(`source syntax OK — ${files.length} files`);
