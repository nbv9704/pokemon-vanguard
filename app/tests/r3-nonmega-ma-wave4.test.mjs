import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [foundation,slice]=await Promise.all([json('../content-src/battle-foundation-v1.json'),json('../content-src/beta-slice-v33.json')]);
const wave=['trevenant','gourgeist','avalugg','noivern','incineroar','toucannon','lycanroc-midday','toxapex','mudsdale','araquanid','salazzle','tsareena','oranguru','passimian','kommo-o','corviknight','flapple','appletun','sandaconda','polteageist','hatterene','mr-rime','runerigus','alcremie','dragapult'];

test('R3-89 Wave 4 has explicit physical foundation for every promoted species',()=>{
 for(const id of wave){const entry=foundation.species[id];assert.ok(entry,`${id} foundation`);assert.ok(entry.heightM>0,`${id} height`);assert.ok(entry.weightKg>0,`${id} weight`);if(entry.genderRate.femaleEighths>=0)assert.equal(entry.genderRate.femaleEighths+entry.genderRate.maleEighths,8,`${id} gender eighths`);else assert.deepEqual(entry.genderRate,{femaleEighths:-1,maleEighths:-1},`${id} genderless`);assert.ok(slice.completeSpeciesIds.includes(id),`${id} complete`);}
 assert.deepEqual(foundation.species.mudsdale,{weightKg:920,genderRate:{femaleEighths:4,maleEighths:4},heightM:2.5});
 assert.deepEqual(foundation.species.avalugg,{weightKg:505,genderRate:{femaleEighths:4,maleEighths:4},heightM:2});
 assert.deepEqual(foundation.species.salazzle,{weightKg:22.2,genderRate:{femaleEighths:8,maleEighths:0},heightM:1.2});
 assert.deepEqual(foundation.species.polteageist,{weightKg:0.4,genderRate:{femaleEighths:-1,maleEighths:-1},heightM:0.2});
 assert.deepEqual(foundation.species.runerigus,{weightKg:66.6,genderRate:{femaleEighths:-1,maleEighths:-1},heightM:1.6});
 assert.deepEqual(foundation.species.dragapult,{weightKg:50,genderRate:{femaleEighths:4,maleEighths:4},heightM:3});
});
