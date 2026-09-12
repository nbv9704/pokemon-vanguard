import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMechanicsCoverage,HANDLER_DEFINITIONS,TEST_EVIDENCE} from '../mechanics-v3/index.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,species,moves,abilities,items,manifests]=await Promise.all([
 json('../content-src/beta-slice-v1.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/items.json'),json('../content-src/mechanics-v3-manifests.json')
]);
const catalog={species,moves,abilities,items};
const coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE);
const validate=value=>validateBetaSlice(value,catalog,coverage);

test('beta-slice-v1:single locks a legal six-member M-A team to supported content',()=>{
 const result=validate(slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,6);assert.deepEqual(result.summary.types,['bug','fighting','ghost','grass','poison','water']);assert.equal(result.summary.abilityIds.length,3);assert.equal(result.summary.itemIds.length,6);
});

test('beta-slice-v1:double requires every selected capability in both formats',()=>{
 const broken=structuredClone(coverage),entry=broken.entries.find(value=>value.kind==='move'&&value.id==='protect');entry.formats.double={supported:false,reason:'test-fixture'};
 const result=validateBetaSlice(slice,catalog,broken);assert.equal(result.ok,false);assert.match(result.problems.join('\n'),/move protect is blocked in double: test-fixture/);
});

test('beta slice rejects illegal learnsets, species duplicates and held-item duplicates',()=>{
 const changed=structuredClone(slice);changed.team[0].moveIds[0]='water-spout';changed.team[1].speciesId=changed.team[0].speciesId;changed.team[1].itemId=changed.team[0].itemId;
 const result=validate(changed);assert.equal(result.ok,false);assert.match(result.problems.join('\n'),/venusaur cannot use water-spout/);assert.match(result.problems.join('\n'),/duplicate species venusaur/);assert.match(result.problems.join('\n'),/duplicate held item miracle-seed/);
});

test('beta slice rejects abilities outside a species legal ability set',()=>{
 const changed=structuredClone(slice);changed.team[0].abilityId='torrent';const result=validate(changed);assert.equal(result.ok,false);assert.match(result.problems.join('\n'),/venusaur cannot use ability torrent/);
});

test('beta slice pins M-A and rejects unavailable held items',()=>{
 const wrongRegulation=validate({...slice,regulationSet:'m-b'});assert.match(wrongRegulation.problems.join('\n'),/requires regulationSet m-a/);
 const changedCatalog=structuredClone(catalog);changedCatalog.items.find(item=>item.id==='miracle-seed').availableInChampions=false;
 const result=validateBetaSlice(slice,changedCatalog,coverage);assert.equal(result.ok,false);assert.match(result.problems.join('\n'),/item miracle-seed is unavailable in Champions/);
});
