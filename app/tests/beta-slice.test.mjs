import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMechanicsCoverage,HANDLER_DEFINITIONS,TEST_EVIDENCE} from '../mechanics-v3/index.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,v16slice,v17slice,species,moves,abilities,items,betaSpecies,betaMoves,betaAbilities,betaItems,manifests]=await Promise.all([
 json('../content-src/beta-slice-v1.json'),json('../content-src/beta-slice-v16.json'),json('../content-src/beta-slice-v17.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/items.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/items.json'),json('../content-src/mechanics-v3-manifests.json')
]);
const catalog={species,moves,abilities,items},betaCatalog={species:betaSpecies,moves:betaMoves,abilities:betaAbilities,items:betaItems};
const coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE),betaCoverage=buildMechanicsCoverage(betaCatalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE);
const validate=value=>validateBetaSlice(value,catalog,coverage),validateV16=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV17=value=>validateBetaSlice(value,betaCatalog,betaCoverage);

test('beta-slice-v1:single locks a legal six-member M-A team to supported content',()=>{
 const result=validate(slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,6);assert.deepEqual(result.summary.types,['bug','fighting','ghost','grass','poison','water']);assert.equal(result.summary.abilityIds.length,3);assert.equal(result.summary.itemIds.length,6);assert.ok(slice.team.every(member=>Object.values(member.statPoints).reduce((sum,value)=>sum+value,0)===66));
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

test('beta slice v16 enables reviewed Item Hooks Wave 2 status-cure content without changing default builds',()=>{
 const result=validateV16(v16slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.deepEqual(v16slice.enabledContent.moveIds,['sunny-day','rain-dance','tailwind','reflect','light-screen','grassy-terrain','misty-terrain','spikes','stealth-rock','rapid-spin','defog','toxic-spikes','wonder-room','yawn','perish-song','solar-beam','solar-blade','hydro-cannon','frenzy-plant','blast-burn','hyper-beam','giga-impact','dig','fly','dive','phantom-force','hyper-voice','waterfall','crunch','liquidation','ice-punch','body-slam','rock-slide','water-pulse','ice-fang','bulldoze']);assert.deepEqual(v16slice.enabledContent.itemIds,['heat-rock','damp-rock','light-clay','terrain-extender','leftovers','sitrus-berry','focus-sash','lum-berry','cheri-berry','chesto-berry','pecha-berry','rawst-berry','aspear-berry','persim-berry']);assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,25);
 const illegalRelation=structuredClone(v16slice);illegalRelation.enabledContent.abilityIds.push('swift-swim');assert.match(validateV16(illegalRelation).problems.join('\n'),/enabled ability swift-swim has no beta species relation/);
 const duplicate=structuredClone(v16slice);duplicate.enabledContent.itemIds.push('terrain-extender');assert.match(validateV16(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});


test('beta slice v17 enables reviewed Item Hooks Wave 3 post-damage content without changing default builds',()=>{
 const result=validateV17(v17slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.deepEqual(v17slice.enabledContent.itemIds,['heat-rock','damp-rock','light-clay','terrain-extender','leftovers','sitrus-berry','focus-sash','lum-berry','cheri-berry','chesto-berry','pecha-berry','rawst-berry','aspear-berry','persim-berry','life-orb','rocky-helmet','shell-bell']);assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,28);
 assert.deepEqual(v17slice.team,v16slice.team);const duplicate=structuredClone(v17slice);duplicate.enabledContent.itemIds.push('life-orb');assert.match(validateV17(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});
