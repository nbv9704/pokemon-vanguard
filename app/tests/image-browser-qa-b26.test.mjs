import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {selectSamples,galleryHtml,evaluateSource} from '../scripts/image-browser-qa-b26.mjs';
const manifest=JSON.parse(await readFile(fileURLToPath(new URL('../docs/image-assets-b25.json',import.meta.url)),'utf8'));
test('B26 gallery selects bounded deterministic samples across UI, ranked and forms',()=>{
 const items=selectSamples(manifest);
 assert.equal(items.length,16);assert.equal(new Set(items.map(item=>item.id)).size,16);
 assert.deepEqual([...new Set(items.map(item=>item.category))],['assets/icons','assets/items','ranks','pokemon-artwork']);
});
test('B26 browser harness exposes original-master baseline and 1x/2x srcset variants',()=>{
 const samples=selectSamples(manifest),original=galleryHtml(samples,{optimized:false}),optimized=galleryHtml(samples,{optimized:true});
 assert.equal((original.match(/<figure>/g)||[]).length,16);
 assert.equal((optimized.match(/srcset="/g)||[]).length,16);
 assert.equal((original.match(/__qa-master/g)||[]).length,16);
 assert.match(optimized,/layout-shift/);
 assert.match(optimized,/decoding="async"/);
 assert.match(evaluateSource(),/resourceBytes/);
 assert.match(evaluateSource(),/firstContentfulPaint/);
});
