import {readFile,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {IMAGE_VARIANTS} from '../public/js/image-variants.js';

const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const PNG_MAGIC='89504e470d0a1a0a';

export async function verifyEntry(record,{root=APP}={}){
 const asset=async(meta,label)=>{
  if(!meta||!meta.file||!/^([\w.-]+\/)*[\w.-]+$/.test(meta.file))throw new Error(`${label}: bad path`);
  const file=path.resolve(root,meta.file);
  if(!file.startsWith(path.resolve(root)+path.sep))throw new Error(`${label}: escapes root`);
  if(!(await realpath(file)).startsWith((await realpath(root))+path.sep))throw new Error(`${label}: symlink escapes root`);
  const bytes=await readFile(file);
  if(sha(bytes)!==meta.sha256||bytes.length!==meta.bytes)throw new Error(`${label}: hash/length mismatch: ${meta.file}`);
  if(meta.file.toLowerCase().endsWith('.png')){
   if(bytes.subarray(0,8).toString('hex')!==PNG_MAGIC||bytes.length<33)throw new Error(`${label}: PNG signature`);
   if(bytes.readUInt32BE(16)!==meta.width||bytes.readUInt32BE(20)!==meta.height)throw new Error(`${label}: PNG dimensions`);
   if(meta.alpha&&!([3,4,6].includes(bytes[25])))throw new Error(`${label}: expected RGBA`);
  }else if(meta.file.endsWith('.gif')){
   if(!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii')))throw new Error(`${label}: GIF signature`);
   if(bytes.readUInt16LE(6)!==meta.width||bytes.readUInt16LE(8)!==meta.height)throw new Error(`${label}: GIF dimensions`);
  }else throw new Error(`${label}: unapproved format`);
  return bytes;
 };
 const original=await asset(record.source||record,`master ${record.id}`);
 if(record.variants){
  const a=record.variants['1x'],b=record.variants['2x'];
  await asset(a,`1x ${record.id}`);await asset(b,`2x ${record.id}`);
  if(a.width>record.displayCssPx||b.width<2*record.displayCssPx-1&&record.source.width>=2*record.displayCssPx)throw new Error(`${record.id}: invalid density`);
  for(const v of [a,b]){
   if(v.url!=='/'+v.file.replace(/^public\//,'')||!new RegExp(`[.-]${v.sha256.slice(0,16)}[.]`).test(v.url))throw new Error(`${record.id}: URL fingerprint mismatch`);
   if(v.height!==Math.max(1,Math.round(record.source.height*v.width/record.source.width)))throw new Error(`${record.id}: aspect ratio changed`);
   if(!v.alpha)throw new Error(`${record.id}: lost alpha`);
  }
  if(record.legacy){
   await asset(record.legacy,`legacy ${record.id}`);
   if(record.legacy.sha256!==b.sha256||!record.legacy.url||record.legacy.url!==record.id)throw new Error(`${record.id}: legacy mismatch`);
  }
 }
 return original.length;
}

export async function verifyInventory({root=APP,strict=true}={}){
 const manifest=JSON.parse(await readFile(path.join(root,'docs/image-assets-b25.json'),'utf8'));
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.items)||!Array.isArray(manifest.sprites))throw new Error('Bad image manifest schema');
 const ids=new Set(),paths=new Set();let sourceBytes=0,oneBytes=0,twoBytes=0;
 for(const entry of [...manifest.items,...manifest.sprites]){
  if(ids.has(entry.id))throw new Error(`Duplicate image ID: ${entry.id}`);ids.add(entry.id);
  sourceBytes+=await verifyEntry(entry,{root});
  if(entry.variants){
   if(!entry.attribution||!entry.licenseStatus)throw new Error(`No rights-review metadata: ${entry.id}`);
   if(!entry.id.startsWith('/pokemon-artwork/')){
    if(!entry.legacy)throw new Error(`Missing legacy source compatibility: ${entry.id}`);
   }
   oneBytes+=entry.variants['1x'].bytes;twoBytes+=entry.variants['2x'].bytes;
   for(const variant of Object.values(entry.variants))paths.add(variant.file);
  }
 }
 if(strict){
  if(manifest.items.length!==303||manifest.sprites.length!==544)throw new Error('Unexpected artwork/animation scope');
  const imageMap=Object.fromEntries(manifest.items.map(entry=>[entry.id,{
   width:entry.displayCssPx,one:entry.variants['1x'].url,two:entry.variants['2x'].url
  }]));
  if(JSON.stringify(imageMap)!==JSON.stringify(IMAGE_VARIANTS))throw new Error('Runtime image map is stale');
  const originals=await readdir(path.join(root,'public/pokemon-artwork'));
  if(originals.filter(name=>name.endsWith('.png')).length!==272)throw new Error('Missing original artwork');
  for(const directory of ['public/assets/optimized','public/pokemon-artwork/portraits']){
   for(const name of await readdir(path.join(root,directory))){
    if(name.endsWith('.png')&&!paths.has(`${directory}/${name}`))throw new Error(`Orphan image variant: ${directory}/${name}`);
   }
  }
  if(!ids.has('/pokemon-sprites/venusaur.gif')||!ids.has('/pokemon-sprites/back/venusaur.gif'))throw new Error('Missing front/back sprite references');
 }
 return {items:manifest.items.length,sprites:manifest.sprites.length,sourceBytes,oneBytes,twoBytes};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await verifyInventory();
 console.log(`B25 responsive image assets OK — ${result.items} images, ${result.sprites} pinned sprites, ${result.oneBytes.toLocaleString()}B 1x, ${result.twoBytes.toLocaleString()}B 2x`);
}
