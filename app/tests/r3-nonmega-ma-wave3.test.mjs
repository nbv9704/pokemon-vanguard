import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [foundation,slice]=await Promise.all([json('../content-src/battle-foundation-v1.json'),json('../content-src/beta-slice-v32.json')]);
const wave=['cofagrigus','garbodor','reuniclus','vanilluxe','emolga','beartic','stunfisk','hydreigon','volcarona','diggersby','talonflame','vivillon','florges','pangoro','furfrou','aromatisse','slurpuff','clawitzer','heliolisk','tyrantrum','aurorus','sylveon','dedenne','goodra','klefki'];

test('R3-88 Wave 3 has explicit physical foundation for every promoted species',()=>{
 for(const id of wave){const entry=foundation.species[id];assert.ok(entry,`${id} foundation`);assert.ok(entry.heightM>0,`${id} height`);assert.ok(entry.weightKg>0,`${id} weight`);assert.equal(entry.genderRate.femaleEighths+entry.genderRate.maleEighths,8,`${id} gender eighths`);assert.ok(slice.completeSpeciesIds.includes(id),`${id} complete`);}
 assert.deepEqual(foundation.species.beartic,{weightKg:260,genderRate:{femaleEighths:4,maleEighths:4},heightM:2.6});
 assert.deepEqual(foundation.species.florges,{weightKg:10,genderRate:{femaleEighths:8,maleEighths:0},heightM:1.1});
 assert.deepEqual(foundation.species.tyrantrum,{weightKg:270,genderRate:{femaleEighths:1,maleEighths:7},heightM:2.5});
 assert.deepEqual(foundation.species.aurorus,{weightKg:225,genderRate:{femaleEighths:1,maleEighths:7},heightM:2.7});
 assert.deepEqual(foundation.species.sylveon,{weightKg:23.5,genderRate:{femaleEighths:1,maleEighths:7},heightM:1});
});
