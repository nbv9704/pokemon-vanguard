import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [foundation,slice]=await Promise.all([json('../content-src/battle-foundation-v1.json'),json('../content-src/beta-slice-v31.json')]);
const wave=['torterra','empoleon','luxray','roserade','rampardos','bastiodon','spiritomb','hippowdon','toxicroak','weavile','rhyperior','leafeon','glaceon','gliscor','mamoswine','serperior','samurott','watchog','liepard','simisage','simisear','simipour','conkeldurr','whimsicott','krookodile'];

test('R3-87 Wave 2 has explicit physical foundation for every promoted species',()=>{
 for(const id of wave){const entry=foundation.species[id];assert.ok(entry,`${id} foundation`);assert.ok(entry.heightM>0,`${id} height`);assert.ok(entry.weightKg>0,`${id} weight`);assert.equal(entry.genderRate.femaleEighths+entry.genderRate.maleEighths,8,`${id} gender eighths`);assert.ok(slice.completeSpeciesIds.includes(id),`${id} complete`);}
 assert.deepEqual(foundation.species.torterra,{weightKg:310,genderRate:{femaleEighths:1,maleEighths:7},heightM:2.2});
 assert.deepEqual(foundation.species.conkeldurr,{weightKg:87,genderRate:{femaleEighths:2,maleEighths:6},heightM:1.4});
 assert.deepEqual(foundation.species.whimsicott,{weightKg:6.6,genderRate:{femaleEighths:4,maleEighths:4},heightM:0.7});
});
