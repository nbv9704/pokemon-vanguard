import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync} from 'node:zlib';
import {v2Catalog} from '../server/v2-catalog.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const deferred=[
 'js/training-editor.js','js/box-view.js','js/team-builder.js','js/v2-battle-screen.js','js/v2-tutorial.js','js/recruitment-view.js','js/damage-inspector.js',
 'training-editor.css','box-view.css','team-builder.css','recruitment.css','v2-battle.css','v2-tutorial.css','damage-inspector.css'
];
const rows=[];
for(const relative of deferred){const body=await readFile(path.join(root,relative));rows.push({path:relative,rawBytes:body.length,brotliBytes:brotliCompressSync(body).length});}
const catalog=Buffer.from(JSON.stringify(v2Catalog)),sum=key=>rows.reduce((total,row)=>total+row[key],0);
console.log(JSON.stringify({scope:'direct legacy route assets deferred from a fresh schema-3 session',requestsAvoided:rows.length+1,directAssets:{count:rows.length,rawBytes:sum('rawBytes'),brotliBytes:sum('brotliBytes')},v2Catalog:{rawBytes:catalog.length,brotliBytes:brotliCompressSync(catalog).length},totalLowerBound:{rawBytes:sum('rawBytes')+catalog.length,brotliBytes:sum('brotliBytes')+brotliCompressSync(catalog).length},files:rows},null,2));
