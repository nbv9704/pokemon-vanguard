import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {v3Catalog} from '../server/v3-catalog.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [foundation,slice]=await Promise.all([json('../content-src/battle-foundation-v1.json'),json('../content-src/beta-slice-v34.json')]);
const wave=['raichu-alola','ninetales-alola','arcanine-hisui','slowbro-galar','tauros-paldea','tauros-paldea-aqua-breed','tauros-paldea-blaze-breed','typhlosion','typhlosion-hisui','slowking-galar','infernape','samurott-hisui','stunfisk-galar','meowstic-female','goodra-hisui','avalugg-hisui','decidueye','decidueye-hisui','primarina','lycanroc-dusk','lycanroc-midnight','wyrdeer','kleavor','basculegion','basculegion-female','sneasler','meowscarada','skeledirge','quaquaval','garganacl'];
const expectedPhysical=new Map([
 ['raichu-alola',[0.7,21,4,4]],['ninetales-alola',[1.1,19.9,6,2]],['arcanine-hisui',[2,168,2,6]],['slowbro-galar',[1.6,70.5,4,4]],
 ['tauros-paldea',[1.4,115,0,8]],['tauros-paldea-aqua-breed',[1.4,110,0,8]],['tauros-paldea-blaze-breed',[1.4,85,0,8]],['typhlosion-hisui',[1.6,69.8,1,7]],
 ['slowking-galar',[1.8,79.5,4,4]],['samurott-hisui',[1.5,58.2,1,7]],['stunfisk-galar',[0.7,20.5,4,4]],['meowstic-female',[0.6,8.5,8,0]],
 ['goodra-hisui',[1.7,334.1,4,4]],['avalugg-hisui',[1.4,262.4,4,4]],['decidueye-hisui',[1.6,37,1,7]],['lycanroc-dusk',[0.8,25,4,4]],
 ['lycanroc-midnight',[1.1,25,4,4]],['wyrdeer',[1.8,95.1,4,4]],['kleavor',[1.8,89,4,4]],['basculegion',[3,110,0,8]],['basculegion-female',[3,110,8,0]],
 ['sneasler',[1.3,43,4,4]],['meowscarada',[1.5,31.2,1,7]],['skeledirge',[1.6,326.5,1,7]],['quaquaval',[1.8,61.9,1,7]],['garganacl',[2.3,240,4,4]],
]);

test('R3-90 Wave 5 makes all 184 active non-Mega M-A entries content-complete',()=>{
 assert.equal(slice.team.length,184);assert.equal(slice.completeSpeciesIds.length,184);assert.equal(v3Catalog.species.length,213);assert.equal(v3Catalog.contentCompleteness.speciesIds.length,213);
 for(const id of wave){assert.ok(slice.team.some(entry=>entry.speciesId===id),id);assert.ok(slice.completeSpeciesIds.includes(id),id);assert.ok(v3Catalog.speciesById[id],id);}
});

test('R3-90 Wave 5 stores explicit form-specific physical data and corrects Primarina gender',()=>{
 for(const [id,[heightM,weightKg,femaleEighths,maleEighths]] of expectedPhysical){const entry=foundation.species[id];assert.ok(entry,id);assert.equal(entry.heightM,heightM,id);assert.equal(entry.weightKg,weightKg,id);assert.deepEqual(entry.genderRate,{femaleEighths,maleEighths},id);assert.equal(v3Catalog.speciesById[id].heightM,heightM,id);assert.equal(v3Catalog.speciesById[id].weightKg,weightKg,id);}
 assert.deepEqual(foundation.species.primarina.genderRate,{femaleEighths:1,maleEighths:7});assert.deepEqual(v3Catalog.speciesById.primarina.genderRate,{femaleEighths:1,maleEighths:7});
});

test('R3-90 slice deliberately kept ambiguous and lifecycle-heavy records outside Wave 5',()=>{
 for(const id of ['ditto','castform','rotom','rotom-fan','rotom-frost','rotom-heat','rotom-mow','rotom-wash','aegislash','zoroark','zoroark-hisui','mimikyu','morpeko','palafin'])assert.ok(!slice.team.some(entry=>entry.speciesId===id),id);
 for(const id of ['aegislash-blade','aegislash-shield','lycanroc'])assert.ok(!slice.team.some(entry=>entry.speciesId===id),id);
 assert.ok(slice.team.some(entry=>entry.speciesId==='lycanroc-midday'));assert.ok(slice.team.some(entry=>entry.speciesId==='lycanroc-dusk'));assert.ok(slice.team.some(entry=>entry.speciesId==='lycanroc-midnight'));
});
