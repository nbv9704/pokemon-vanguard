import {createHash} from 'node:crypto';
import {readdir,readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=path.join(root,'public');
const output=path.join(publicDir,'asset-manifest.json');
const roots=['assets','item-sprites','pokemon-artwork','pokemon-sprites','ranks'];
const rootFiles=['logo.png','pokemon-placeholder.svg'];
const mime={'.gif':'image/gif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const sha256=body=>createHash('sha256').update(body).digest('hex');

async function walk(relative){
 const absolute=path.join(publicDir,relative),entries=await readdir(absolute,{withFileTypes:true});
 const files=[];
 for(const entry of entries){const child=path.posix.join(relative.replaceAll('\\','/'),entry.name);if(entry.isDirectory())files.push(...await walk(child));else if(entry.isFile())files.push(child);}
 return files;
}
function dimensions(body,extension){
 if(extension==='.png'&&body.length>=24&&body.subarray(1,4).toString()==='PNG')return {width:body.readUInt32BE(16),height:body.readUInt32BE(20)};
 if(extension==='.gif'&&body.length>=10&&body.subarray(0,3).toString()==='GIF')return {width:body.readUInt16LE(6),height:body.readUInt16LE(8)};
 if(extension==='.svg'){
  const head=body.subarray(0,4096).toString('utf8'),viewBox=head.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i),width=head.match(/\bwidth=["']([\d.]+)/i),height=head.match(/\bheight=["']([\d.]+)/i);
  const w=Number(width?.[1]||viewBox?.[1]),h=Number(height?.[1]||viewBox?.[2]);if(Number.isFinite(w)&&Number.isFinite(h))return {width:w,height:h};
 }
 return {};
}
function group(relative){
 if(relative.startsWith('pokemon-sprites/'))return 'battle-sprites';
 if(relative.startsWith('pokemon-artwork/'))return 'pokemon-artwork';
 if(relative.startsWith('assets/icons/')||relative==='logo.png')return 'shell';
 if(relative.startsWith('assets/ui/'))return 'battle-ui';
 if(relative.startsWith('assets/items/')||relative.startsWith('item-sprites/'))return 'items';
 if(relative.startsWith('ranks/'))return 'ranked';
 return 'shared';
}

const paths=[...rootFiles];for(const directory of roots)paths.push(...await walk(directory));paths.sort();
const entries=[];
for(const relative of paths){
 const absolute=path.join(publicDir,relative),body=await readFile(absolute),extension=path.extname(relative).toLowerCase(),fileStat=await stat(absolute);
 entries.push({id:`/${relative}`,path:`/${relative}`,sha256:sha256(body),bytes:fileStat.size,mime:mime[extension]||'application/octet-stream',...dimensions(body,extension),group:group(relative),essential:relative==='logo.png'||relative==='pokemon-placeholder.svg'});
}
const releaseHash=sha256(Buffer.from(entries.map(entry=>`${entry.path}\0${entry.sha256}\0${entry.bytes}`).join('\n')));
const groups=Object.fromEntries([...new Set(entries.map(entry=>entry.group))].sort().map(name=>[name,{files:entries.filter(entry=>entry.group===name).length,bytes:entries.filter(entry=>entry.group===name).reduce((sum,entry)=>sum+entry.bytes,0)}]));
const manifest={schemaVersion:1,release:`sha256-${releaseHash}`,generatedBy:'scripts/generate-runtime-asset-manifest.mjs',scope:'public runtime media; distribution rights remain tracked separately',totals:{files:entries.length,bytes:entries.reduce((sum,entry)=>sum+entry.bytes,0)},groups,entries};
const serialized=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--verify')){const current=await readFile(output,'utf8');if(current!==serialized)throw new Error('Runtime asset manifest is stale; run npm run assets:manifest');}
else await writeFile(output,serialized);
console.log(`runtime asset manifest OK — ${manifest.totals.files} files, ${manifest.totals.bytes} bytes, ${manifest.release.slice(0,23)}…`);
