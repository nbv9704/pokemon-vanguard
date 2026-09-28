/** Offline contract for project-owned type and move-category artwork. */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MOVE_CATEGORY_SYMBOLS,POKEMON_TYPE_SYMBOLS,SYMBOL_DIMENSIONS} from '../public/js/ui/pokemon-symbol-assets-data.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RUNTIME_FILES=['public/js/ui/pokemon-symbol-assets-data.js','public/js/ui/pokemon-symbol-assets.js','local-server.mjs','server/http-request-handler.mjs'];

export function projectUiSymbolEntries(){
 const rows=[];
 for(const [id,files] of Object.entries(POKEMON_TYPE_SYMBOLS)){
  rows.push({kind:'type-icon',id,path:`public/assets/ui/pokemon-types/icon/${files.icon}`,size:SYMBOL_DIMENSIONS.typeIcon});
  rows.push({kind:'type-ic',id,path:`public/assets/ui/pokemon-types/ic/${files.ic}`,size:SYMBOL_DIMENSIONS.typeIc});
 }
 for(const [id,{file}] of Object.entries(MOVE_CATEGORY_SYMBOLS))rows.push({kind:'move-category',id,path:`public/assets/ui/move-categories/${file}`,size:SYMBOL_DIMENSIONS.moveCategory});
 return rows;
}

export function pngDimensions(bytes){
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('not a PNG');
 return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}

export async function assertRuntimeLocalOnly({root=ROOT,read=readFile}={}){
 for(const relative of RUNTIME_FILES){
  const source=await read(path.join(root,relative),'utf8');
  const externalInSymbolModule=relative.startsWith('public/js/ui/pokemon-symbol-assets')&&/https?:\/\//i.test(source);
  if(/\/api\/ui-symbols\/|archives\.bulbagarden\.net/i.test(source)||externalInSymbolModule)throw Error(`${relative}: UI symbols must not depend on an external URL or proxy route`);
 }
}

export async function inspectProjectUiSymbols({root=ROOT,read=readFile,requireComplete=false}={}){
 const entries=projectUiSymbolEntries(),unique=new Set();let present=0;
 if(entries.length!==39)throw Error(`Project UI symbol contract must contain 39 paths, got ${entries.length}`);
 for(const entry of entries){
  if(!/^public\/assets\/ui\/(pokemon-types\/(icon|ic)|move-categories)\/[a-z]+\.png$/.test(entry.path)||unique.has(entry.path))throw Error(`Invalid or duplicate project UI symbol path: ${entry.path}`);
  unique.add(entry.path);
  let bytes;
  try{bytes=await read(path.join(root,entry.path));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const actual=pngDimensions(bytes);
  if(actual[0]!==entry.size[0]||actual[1]!==entry.size[1])throw Error(`${entry.path}: expected ${entry.size.join('x')}, got ${actual.join('x')}`);
  present++;
 }
 await assertRuntimeLocalOnly({root,read});
 if(requireComplete&&present!==entries.length)throw Error(`Project UI symbols incomplete: ${present}/${entries.length}. See public/assets/ui/README.md.`);
 return {expected:entries.length,present,awaitingOriginal:entries.length-present,complete:present===entries.length,delivery:'project-owned-local-only'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await inspectProjectUiSymbols({requireComplete:process.argv.includes('--require-complete')});
 console.log(`Project UI symbol contract OK: ${result.present}/${result.expected} present; ${result.awaitingOriginal} awaiting original artwork; local-only runtime.`);
}
