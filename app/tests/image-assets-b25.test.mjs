import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {IMAGE_VARIANTS,imageVariant,imageAttributes} from '../public/js/image-variants.js';
import {rewardIcon} from '../public/js/reward-assets.js';
import {rankedTierEmblem} from '../public/js/ranked-tier-view.js';
import {verifyEntry,verifyInventory} from '../scripts/validate-image-assets-b25.mjs';
import {createStaticHttpResponse} from '../server/http-public-assets.mjs';

const app=fileURLToPath(new URL('..',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(app,'docs/image-assets-b25.json'),'utf8'));
const byId=id=>manifest.items.find(item=>item.id===id);

test('B25 manifest pins every resized PNG and all original animated sprites',async()=>{
 const result=await verifyInventory();
 assert.equal(result.items,303);assert.equal(result.sprites,544);
 assert.equal(manifest.items.filter(item=>item.category==='pokemon-artwork').length,272);
 assert.equal(manifest.items.filter(item=>item.category==='assets/icons').length,17);
 assert.equal(manifest.items.filter(item=>item.category==='assets/items').length,9);
 assert.equal(manifest.items.filter(item=>item.category==='ranks').length,5);
 assert.equal(new Set(manifest.sprites.map(item=>item.id)).size,544);
 for(const entry of manifest.items){
  assert.ok(entry.licenseStatus&&entry.attribution);
  assert.equal(entry.variants['1x'].url.includes(entry.variants['1x'].sha256.slice(0,16)),true);
  assert.equal(imageVariant(entry.id).one,entry.variants['1x'].url);
 }
});

test('strict checksum verification rejects tampered variant, including valid-looking PNG',async()=>{
 const original=byId('/ranks/pokeball.png');const temp=await mkdtemp(path.join(tmpdir(),'pv-b25-image-'));
 try{
  for(const meta of [original.source,original.variants['1x'],original.variants['2x'],original.legacy]){
   const output=path.join(temp,meta.file);await mkdir(path.dirname(output),{recursive:true});
   await writeFile(output,await readFile(path.join(app,meta.file)));
  }
  assert.ok(await verifyEntry(original,{root:temp}));
  const location=path.join(temp,original.variants['1x'].file),bytes=await readFile(location);
  bytes[bytes.length-25]^=1;await writeFile(location,bytes);
  await assert.rejects(verifyEntry(original,{root:temp}),/hash\/length mismatch/);
 }finally{await rm(temp,{force:true,recursive:true});}
});

test('responsive HTML keeps legacy URLs and uses correctly sized 1x/2x with safe fallback',()=>{
 const vp=rewardIcon('vp');assert.match(vp,/src="\/assets\/icons\/vp.png"/);
 assert.match(vp,/srcset="[^\"]+ 1x, [^\"]+ 2x"/);
 assert.match(vp,/width="56" height="56"/);
 assert.doesNotMatch(vp,/loading="lazy"/); // first-screen currency must not be deferred
 const rank=rankedTierEmblem({tier:'Great Ball',tierAsset:'/ranks/greatball.png'});
 assert.match(rank,/width="104" height="104"/);assert.match(rank,/2x"/);
 const portrait=imageAttributes('/pokemon-artwork/venusaur.png',{size:52});
 assert.match(portrait,/srcset="[^\"]+ 1x, [^\"]+ 2x"/);
 assert.match(portrait,/width="52" height="52" loading="lazy" decoding="async"/);
 assert.match(imageAttributes('" onerror="hack',{size:44}),/&quot; onerror=&quot;hack/);
 assert.equal(IMAGE_VARIANTS['/pokemon-sprites/venusaur.gif'],undefined); // GIF animations remain untouched
});

test('hashed variants are served immutable; legacy URLs remain revalidatable and transfer fewer bytes',async()=>{
 const serve=createStaticHttpResponse(path.join(app,'public'));
 const server=createServer(async(req,res)=>{try{await serve(req,res,new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(500);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`,entry=byId('/ranks/pokeball.png');
  const one=await fetch(base+entry.variants['1x'].url),bytes=new Uint8Array(await one.arrayBuffer());
  assert.equal(one.status,200);assert.match(one.headers.get('cache-control'),/immutable/);
  assert.equal(bytes.length,entry.variants['1x'].bytes);assert.equal(one.headers.get('content-encoding'),null);
  const legacy=await fetch(base+entry.id);assert.equal(legacy.status,200);
  assert.equal(legacy.headers.get('cache-control'),'public, no-cache');
  assert.equal((await legacy.arrayBuffer()).byteLength,entry.variants['2x'].bytes);
  assert.ok(entry.source.bytes>entry.variants['2x'].bytes*2);
  const head=await fetch(base+entry.variants['2x'].url,{method:'HEAD'});
  assert.equal(head.headers.get('content-length'),String(entry.variants['2x'].bytes));
  assert.equal((await head.arrayBuffer()).byteLength,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
