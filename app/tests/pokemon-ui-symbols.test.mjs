import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MOVE_CATEGORY_SYMBOLS,POKEMON_TYPE_SYMBOLS,SYMBOL_DIMENSIONS} from '../public/js/ui/pokemon-symbol-assets-data.js';
import {moveCategoryAsset,moveCategoryIds,moveCategoryImg,pokemonTypeIds,typeStripList,typeSymbolAsset,typeSymbolImg} from '../public/js/ui/pokemon-symbol-assets.js';

test('project symbol catalog covers all 18 types and all three move categories',()=>{
 assert.equal(pokemonTypeIds.length,18);
 assert.equal(moveCategoryIds.length,3);
 assert.deepEqual(moveCategoryIds,['physical','special','status']);
 assert.deepEqual(SYMBOL_DIMENSIONS,{typeIcon:[86,86],typeIc:[120,28],moveCategory:[50,50]});
 for(const id of pokemonTypeIds){
  const entry=POKEMON_TYPE_SYMBOLS[id];
  assert.equal(entry.icon,`${id}.png`);
  assert.equal(entry.ic,`${id}.png`);
  assert.match(typeSymbolAsset(id).local,/^\/assets\/ui\/pokemon-types\/icon\//);
  assert.match(typeSymbolAsset(id,'ic').local,/^\/assets\/ui\/pokemon-types\/ic\//);
  assert.equal('fallback' in typeSymbolAsset(id),false);
 }
 for(const id of moveCategoryIds){
  assert.equal(MOVE_CATEGORY_SYMBOLS[id].file,`${id}.png`);
  assert.match(moveCategoryAsset(id).local,/^\/assets\/ui\/move-categories\//);
 }
});

test('symbol helpers render local-only images with accessible text-fallback metadata',()=>{
 const icon=typeSymbolImg('fire'),strip=typeStripList(['water','flying']),category=moveCategoryImg('special');
 assert.match(icon,/src="\/assets\/ui\/pokemon-types\/icon\/fire\.png"/);
 assert.doesNotMatch(icon,/data-pv-fallback-src|https?:\/\/|\/api\/ui-symbols/);
 assert.equal((strip.match(/pv-type-symbol-ic/g)||[]).length,2);
 assert.match(category,/special\.png/);
 assert.match(category,/pv-move-category-symbol/);
 assert.match(category,/pv-move-category-special/);
});

test('production UI surfaces consume the shared project symbol helpers',async()=>{
 const sources=await Promise.all([
  '../public/js/v3-training-editor.js','../public/js/v3-team-builder.js','../public/js/v3-recruitment-view.js','../public/js/v3-overview-view.js','../public/js/ui/handlers/battle-command-ui-handler.js'
 ].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 assert.match(sources[0],/moveCategoryImg/);assert.match(sources[0],/typeStripList/);
 assert.match(sources[1],/moveCategoryImg/);assert.match(sources[1],/typeSymbolImg/);
 assert.match(sources[2],/moveCategoryImg/);assert.match(sources[2],/typeStripList/);
 assert.match(sources[3],/typeStripList/);
 assert.match(sources[4],/moveCategoryImg/);assert.match(sources[4],/typeSymbolImg/);
});

test('symbol stylesheet wins final image rendering and HTML loads it last',async()=>{
 const css=await readFile(new URL('../public/pokemon-symbols.css',import.meta.url),'utf8');
 const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const classic=await readFile(new URL('../public/classic.html',import.meta.url),'utf8');
 assert.match(css,/image-rendering:pixelated!important/);
 assert.ok(index.indexOf('/pokemon-symbols.css')>index.indexOf('/pixel-era-ui.css'));
 assert.ok(classic.indexOf('/pokemon-symbols.css')>classic.indexOf('/classic-ui.css'));
});


test('battle move cards use icon-only type/category metadata and semantic category colors',async()=>{
 const handler=await readFile(new URL('../public/js/ui/handlers/battle-command-ui-handler.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/pokemon-symbols.css',import.meta.url),'utf8');
 assert.match(handler,/move-card-main/);
 assert.match(handler,/move-symbol-row/);
 assert.match(handler,/move-card-stats/);
 assert.doesNotMatch(handler,/\$\{esc\(move\.type\)\} · \$\{esc\(move\.category\)\}/);
 assert.match(css,/pv-move-category-physical/);
 assert.match(css,/pv-move-category-special/);
 assert.match(css,/pv-move-category-status/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto!important/);
});
