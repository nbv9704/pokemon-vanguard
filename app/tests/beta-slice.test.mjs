import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMechanicsCoverage,HANDLER_DEFINITIONS,TEST_EVIDENCE} from '../mechanics-v3/index.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,v16slice,v17slice,v18slice,v19slice,v20slice,v21slice,v22slice,species,moves,abilities,items,betaSpecies,betaMoves,betaAbilities,betaItems,manifests]=await Promise.all([
 json('../content-src/beta-slice-v1.json'),json('../content-src/beta-slice-v16.json'),json('../content-src/beta-slice-v17.json'),json('../content-src/beta-slice-v18.json'),json('../content-src/beta-slice-v19.json'),json('../content-src/beta-slice-v20.json'),json('../content-src/beta-slice-v21.json'),json('../content-src/beta-slice-v22.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/items.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/items.json'),json('../content-src/mechanics-v3-manifests.json')
]);
const catalog={species,moves,abilities,items},betaCatalog={species:betaSpecies,moves:betaMoves,abilities:betaAbilities,items:betaItems};
const coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE),betaCoverage=buildMechanicsCoverage(betaCatalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE);
const validate=value=>validateBetaSlice(value,catalog,coverage),validateV16=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV17=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV18=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV19=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV20=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV21=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV22=value=>validateBetaSlice(value,betaCatalog,betaCoverage);

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

test('beta slice v18 enables reviewed Item Hooks Wave 4 Choice Scarf without changing default builds',()=>{
 const result=validateV18(v18slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(v18slice.enabledContent.itemIds.at(-1),'choice-scarf');assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,29);
 assert.deepEqual(v18slice.team,v17slice.team);const duplicate=structuredClone(v18slice);duplicate.enabledContent.itemIds.push('choice-scarf');assert.match(validateV18(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});

test('beta slice v19 enables reviewed Item Hooks Wave 5 White Herb without changing default builds',()=>{
 const result=validateV19(v19slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(v19slice.enabledContent.itemIds.at(-1),'white-herb');assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,30);
 assert.deepEqual(v19slice.team,v18slice.team);const duplicate=structuredClone(v19slice);duplicate.enabledContent.itemIds.push('white-herb');assert.match(validateV19(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});


test('beta slice v20 enables resistance berries and reviewed low-risk passive items without changing default builds',()=>{
 const result=validateV20(v20slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,63);assert.deepEqual(v20slice.team,v19slice.team);
 for(const id of ['occa-berry','roseli-berry','chilan-berry','black-glasses','twisted-spoon','expert-belt','wide-lens','oran-berry','bright-powder','scope-lens','focus-band'])assert.ok(v20slice.enabledContent.itemIds.includes(id),id);
 const duplicate=structuredClone(v20slice);duplicate.enabledContent.itemIds.push('occa-berry');assert.match(validateV20(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});


test('beta slice v21 enables reviewed lifecycle item families without changing default builds',()=>{
 const result=validateV21(v21slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.moveIds.length,65);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,80);assert.deepEqual(v21slice.team,v20slice.team);
 for(const id of ['air-balloon','big-root','electric-seed','grassy-seed','misty-seed','psychic-seed','iron-ball','leppa-berry','normal-gem','red-card','zoom-lens','kings-rock','metronome','light-ball','leek','mental-herb','quick-claw'])assert.ok(v21slice.enabledContent.itemIds.includes(id),id);
 const duplicate=structuredClone(v21slice);duplicate.enabledContent.itemIds.push('air-balloon');assert.match(validateV21(duplicate).problems.join('\n'),/enabledContent.itemIds must contain distinct IDs/);
});


test('beta slice v22 enables reviewed Snow and Sandstorm content without changing default builds',()=>{
 const result=validateV22(v22slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.moveIds.length,67);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,82);assert.deepEqual(v22slice.team,v21slice.team);
 for(const id of ['sandstorm','snowscape'])assert.ok(v22slice.enabledContent.moveIds.includes(id),id);for(const id of ['icy-rock','smooth-rock'])assert.ok(v22slice.enabledContent.itemIds.includes(id),id);
 for(const id of ['sand-rush','slush-rush','ice-body','sand-force','sand-veil','snow-cloak'])assert.ok(!v22slice.enabledContent.abilityIds.includes(id),id);
 const illegalRelation=structuredClone(v22slice);illegalRelation.enabledContent.abilityIds.push('sand-rush');assert.match(validateV22(illegalRelation).problems.join('\n'),/enabled ability sand-rush has no beta species relation/);
});
