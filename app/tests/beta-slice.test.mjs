import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMechanicsCoverage,HANDLER_DEFINITIONS,TEST_EVIDENCE} from '../mechanics-v3/index.mjs';
import {validateBetaSlice} from '../mechanics-v3/beta-slice.mjs';
import {applyMaCanonicalOverlay} from '../content-import/ma-canonical.mjs';

const json=url=>readFile(new URL(url,import.meta.url),'utf8').then(JSON.parse);
const [slice,v16slice,v17slice,v18slice,v19slice,v20slice,v21slice,v22slice,v23slice,v24slice,v25slice,v26slice,v27slice,v28slice,v29slice,v30slice,v31slice,v32slice,v33slice,v34slice,v35slice,species,moves,abilities,items,betaSpeciesRaw,betaMoves,betaAbilities,betaItems,manifests,canonical]=await Promise.all([
 json('../content-src/beta-slice-v1.json'),json('../content-src/beta-slice-v16.json'),json('../content-src/beta-slice-v17.json'),json('../content-src/beta-slice-v18.json'),json('../content-src/beta-slice-v19.json'),json('../content-src/beta-slice-v20.json'),json('../content-src/beta-slice-v21.json'),json('../content-src/beta-slice-v22.json'),json('../content-src/beta-slice-v23.json'),json('../content-src/beta-slice-v24.json'),json('../content-src/beta-slice-v25.json'),json('../content-src/beta-slice-v26.json'),json('../content-src/beta-slice-v27.json'),json('../content-src/beta-slice-v28.json'),json('../content-src/beta-slice-v29.json'),json('../content-src/beta-slice-v30.json'),json('../content-src/beta-slice-v31.json'),json('../content-src/beta-slice-v32.json'),json('../content-src/beta-slice-v33.json'),json('../content-src/beta-slice-v34.json'),json('../content-src/beta-slice-v35.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-11/normalized/items.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/species.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/abilities.json'),json('../content-candidates/pv-ma-2026-09-12-beta2/normalized/items.json'),json('../content-src/mechanics-v3-manifests.json'),json('../content-src/ma-canonical-v1.json')
]);
const betaSpecies=applyMaCanonicalOverlay(betaSpeciesRaw,canonical);
const catalog={species,moves,abilities,items},betaCatalog={species:betaSpecies,moves:betaMoves,abilities:betaAbilities,items:betaItems};
const coverage=buildMechanicsCoverage(catalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE),betaCoverage=buildMechanicsCoverage(betaCatalog,manifests,HANDLER_DEFINITIONS.map(entry=>entry.id),TEST_EVIDENCE);
const validate=value=>validateBetaSlice(value,catalog,coverage),validateV16=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV17=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV18=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV19=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV20=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV21=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV22=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV23=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV24=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV25=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV26=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV27=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV28=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV29=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV30=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV31=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV32=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV33=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV34=value=>validateBetaSlice(value,betaCatalog,betaCoverage),validateV35=value=>validateBetaSlice(value,betaCatalog,betaCoverage);

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


test('beta slice v23 refreshes reviewed mechanics metadata without changing playable content',()=>{
 const result=validateV23(v23slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.moveIds.length,67);assert.equal(result.summary.abilityIds.length,16);assert.equal(result.summary.itemIds.length,82);
 assert.deepEqual(v23slice.team,v22slice.team);assert.deepEqual(v23slice.enabledContent,v22slice.enabledContent);assert.deepEqual(manifests.moves['water-pulse'].tags,['pulse']);
});


test('beta slice v24 promotes the first Mega-first roster expansion without widening ordinary move/item content',()=>{
 const result=validateV24(v24slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,16);assert.equal(result.summary.moveIds.length,67);assert.equal(result.summary.abilityIds.length,18);assert.equal(result.summary.itemIds.length,82);
 for(const id of ['steelix','camerupt','heracross','medicham'])assert.ok(v24slice.team.some(member=>member.speciesId===id),id);
 for(const id of ['solid-rock','pure-power'])assert.ok(v24slice.enabledContent.abilityIds.includes(id),id);
 assert.deepEqual(v24slice.enabledContent.moveIds,v23slice.enabledContent.moveIds);assert.deepEqual(v24slice.enabledContent.itemIds,v23slice.enabledContent.itemIds);
 const duplicate=structuredClone(v24slice);duplicate.team.push(structuredClone(duplicate.team.find(member=>member.speciesId==='steelix')));assert.match(validateV24(duplicate).problems.join('\n'),/duplicate species steelix/);
});


test('beta slice v25 makes every promoted Mega base species vertically complete',()=>{
 const result=validateV25(v25slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,16);assert.equal(result.summary.moveIds.length,285);assert.equal(result.summary.abilityIds.length,26);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,12);
 for(const id of ['venusaur','blastoise','beedrill','charizard','chesnaught','scizor','feraligatr','meganium','steelix','camerupt','heracross','medicham'])assert.ok(v25slice.completeSpeciesIds.includes(id),id);
 const incompleteMove=structuredClone(v25slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='head-smash');assert.match(validateV25(incompleteMove).problems.join('\n'),/complete species steelix missing legal move head-smash/);
 const incompleteAbility=structuredClone(v25slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='moxie');assert.match(validateV25(incompleteAbility).problems.join('\n'),/complete species heracross missing legal ability moxie/);
 const missingBase=structuredClone(v25slice);missingBase.team=missingBase.team.filter(member=>member.speciesId!=='medicham');assert.match(validateV25(missingBase).problems.join('\n'),/complete species medicham is not in the playable beta catalog/);
});


test('beta slice v26 promotes six more Mega-first base species as vertical-complete content',()=>{
 const result=validateV26(v26slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,22);assert.equal(result.summary.moveIds.length,322);assert.equal(result.summary.abilityIds.length,38);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,18);
 for(const id of ['alakazam','aerodactyl','garchomp','gyarados','ampharos','manectric']){assert.ok(v26slice.team.some(member=>member.speciesId===id),id);assert.ok(v26slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v26slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='future-sight');assert.match(validateV26(incompleteMove).problems.join('\n'),/complete species alakazam missing legal move future-sight/);
 const incompleteAbility=structuredClone(v26slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='sand-veil');assert.match(validateV26(incompleteAbility).problems.join('\n'),/complete species garchomp missing legal ability sand-veil/);
});


test('beta slice v27 promotes a ten-species Mega-first batch as vertical-complete content',()=>{
 const result=validateV27(v27slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,32);assert.equal(result.summary.moveIds.length,367);assert.equal(result.summary.abilityIds.length,56);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,28);
 for(const id of ['abomasnow','absol','altaria','audino','banette','gallade','gardevoir','glalie','houndoom','lucario']){assert.ok(v27slice.team.some(member=>member.speciesId===id),id);assert.ok(v27slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v27slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='aurora-veil');assert.match(validateV27(incompleteMove).problems.join('\n'),/complete species abomasnow missing legal move aurora-veil/);
 const incompleteAbility=structuredClone(v27slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='justified');assert.match(validateV27(incompleteAbility).problems.join('\n'),/complete species absol missing legal ability justified/);
 const tooLarge=structuredClone(v27slice);while(tooLarge.team.length<257)tooLarge.team.push(structuredClone(tooLarge.team[0]));assert.match(validateV27(tooLarge).problems.join('\n'),/expanded beta slice requires 8-256 catalog members/);
});

test('beta slice v28 promotes a thirteen-species Mega-first batch as vertical-complete content',()=>{
 const result=validateV28(v28slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,45);assert.equal(result.summary.moveIds.length,386);assert.equal(result.summary.abilityIds.length,77);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,41);
 for(const id of ['lopunny','pidgeot','sableye','sharpedo','slowbro','tyranitar','chandelure','dragonite','clefable','froslass','hawlucha','starmie','delphox']){assert.ok(v28slice.team.some(member=>member.speciesId===id),id);assert.ok(v28slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v28slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='air-slash');assert.match(validateV28(incompleteMove).problems.join('\n'),/complete species pidgeot missing legal move air-slash/);
 const incompleteAbility=structuredClone(v28slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='analytic');assert.match(validateV28(incompleteAbility).problems.join('\n'),/complete species starmie missing legal ability analytic/);
});



test('beta slice v29 promotes an eighteen-species Mega-first Wave 8 as vertical-complete content',()=>{
 const result=validateV29(v29slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,63);assert.equal(result.summary.moveIds.length,415);assert.equal(result.summary.abilityIds.length,96);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,59);
 for(const id of ['aggron','chimecho','crabominable','drampa','emboar','excadrill','floette','gengar','glimmora','golurk','greninja','kangaskhan','meowstic','pinsir','raichu','scovillain','skarmory','victreebel']){assert.ok(v29slice.team.some(member=>member.speciesId===id),id);assert.ok(v29slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v29slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='horn-drill');assert.match(validateV29(incompleteMove).problems.join('\n'),/complete species excadrill missing legal move horn-drill/);
 const incompleteAbility=structuredClone(v29slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='corrosion');assert.match(validateV29(incompleteAbility).problems.join('\n'),/complete species glimmora missing legal ability corrosion/);
});


test('beta slice v30 promotes the first twenty non-Mega M-A species as vertical-complete content',()=>{
 const result=validateV30(v30slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,83);assert.equal(result.summary.moveIds.length,427);assert.equal(result.summary.abilityIds.length,112);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,79);
 const wave=['arbok','pikachu','ninetales','arcanine','machamp','tauros','vaporeon','jolteon','flareon','snorlax','ariados','azumarill','politoed','espeon','umbreon','slowking','forretress','pelipper','torkoal','milotic'];
 for(const id of wave){assert.ok(v30slice.team.some(member=>member.speciesId===id),id);assert.ok(v30slice.completeSpeciesIds.includes(id),id);}
 for(const deferred of ['barbaracle','blaziken','dragalge','eelektross','falinks','malamar','mawile','metagross','pyroar','sceptile','scolipede','scrafty','staraptor','swampert'])assert.equal(v30slice.team.some(member=>member.speciesId===deferred),false,`deferred Mega target leaked into Wave 1: ${deferred}`);
 const incompleteMove=structuredClone(v30slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='megahorn');assert.match(validateV30(incompleteMove).problems.join('\n'),/complete species ariados missing legal move megahorn/);
 const incompleteAbility=structuredClone(v30slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='marvel-scale');assert.match(validateV30(incompleteAbility).problems.join('\n'),/complete species milotic missing legal ability marvel-scale/);
});

test('beta slice v31 promotes 25 more non-Mega M-A species as vertical-complete content',()=>{
 const result=validateV31(v31slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,108);assert.equal(result.summary.moveIds.length,431);assert.equal(result.summary.abilityIds.length,120);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,104);
 const wave=['torterra','empoleon','luxray','roserade','rampardos','bastiodon','spiritomb','hippowdon','toxicroak','weavile','rhyperior','leafeon','glaceon','gliscor','mamoswine','serperior','samurott','watchog','liepard','simisage','simisear','simipour','conkeldurr','whimsicott','krookodile'];
 for(const id of wave){assert.ok(v31slice.team.some(member=>member.speciesId===id),id);assert.ok(v31slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v31slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='headlong-rush');assert.match(validateV31(incompleteMove).problems.join('\n'),/complete species torterra missing legal move headlong-rush/);
 const incompleteAbility=structuredClone(v31slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='poison-touch');assert.match(validateV31(incompleteAbility).problems.join('\n'),/complete species toxicroak missing legal ability poison-touch/);
});



test('beta slice v32 promotes 25 more non-Mega M-A species as vertical-complete content',()=>{
 const result=validateV32(v32slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,133);assert.equal(result.summary.moveIds.length,440);assert.equal(result.summary.abilityIds.length,140);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,129);
 const wave=['cofagrigus','garbodor','reuniclus','vanilluxe','emolga','beartic','stunfisk','hydreigon','volcarona','diggersby','talonflame','vivillon','florges','pangoro','furfrou','aromatisse','slurpuff','clawitzer','heliolisk','tyrantrum','aurorus','sylveon','dedenne','goodra','klefki'];
 for(const id of wave){assert.ok(v32slice.team.some(member=>member.speciesId===id),id);assert.ok(v32slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v32slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='mean-look');assert.match(validateV32(incompleteMove).problems.join('\n'),/complete species cofagrigus missing legal move mean-look/);
 const incompleteAbility=structuredClone(v32slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='aftermath');assert.match(validateV32(incompleteAbility).problems.join('\n'),/complete species garbodor missing legal ability aftermath/);
});


test('beta slice v33 promotes 25 more non-Mega M-A species as vertical-complete content',()=>{
 const result=validateV33(v33slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,158);assert.equal(result.summary.moveIds.length,460);assert.equal(result.summary.abilityIds.length,155);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,154);
 const wave=['trevenant','gourgeist','avalugg','noivern','incineroar','toucannon','lycanroc-midday','toxapex','mudsdale','araquanid','salazzle','tsareena','oranguru','passimian','kommo-o','corviknight','flapple','appletun','sandaconda','polteageist','hatterene','mr-rime','runerigus','alcremie','dragapult'];
 for(const id of wave){assert.ok(v33slice.team.some(member=>member.speciesId===id),id);assert.ok(v33slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v33slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='forests-curse');assert.match(validateV33(incompleteMove).problems.join('\n'),/complete species trevenant missing legal move forests-curse/);
 const incompleteAbility=structuredClone(v33slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='merciless');assert.match(validateV33(incompleteAbility).problems.join('\n'),/complete species toxapex missing legal ability merciless/);
});


test('beta slice v34 promotes 30 more non-Mega M-A entries as vertical-complete content',()=>{
 const result=validateV34(v34slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,184);assert.equal(result.summary.moveIds.length,472);assert.equal(result.summary.abilityIds.length,163);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,184);
 const wave=['raichu-alola','ninetales-alola','arcanine-hisui','slowbro-galar','tauros-paldea','tauros-paldea-aqua-breed','tauros-paldea-blaze-breed','typhlosion','typhlosion-hisui','slowking-galar','infernape','samurott-hisui','stunfisk-galar','meowstic-female','goodra-hisui','avalugg-hisui','decidueye','decidueye-hisui','primarina','lycanroc-dusk','lycanroc-midnight','wyrdeer','kleavor','basculegion','basculegion-female','sneasler','meowscarada','skeledirge','quaquaval','garganacl'];
 for(const id of wave){assert.ok(v34slice.team.some(member=>member.speciesId===id),id);assert.ok(v34slice.completeSpeciesIds.includes(id),id);}
 const incompleteMove=structuredClone(v34slice);incompleteMove.enabledContent.moveIds=incompleteMove.enabledContent.moveIds.filter(id=>id!=='acid-spray');assert.match(validateV34(incompleteMove).problems.join('\n'),/complete species slowbro-galar missing legal move acid-spray/);
 const incompleteAbility=structuredClone(v34slice);incompleteAbility.enabledContent.abilityIds=incompleteAbility.enabledContent.abilityIds.filter(id=>id!=='quick-draw');assert.match(validateV34(incompleteAbility).problems.join('\n'),/complete species slowbro-galar missing legal ability quick-draw/);
});


test('beta slice v35 completes all 213 canonical non-Mega M-A selector entries',()=>{
 const result=validateV35(v35slice);assert.equal(result.ok,true,result.problems.join('\n'));assert.equal(result.summary.members,213);assert.equal(result.summary.moveIds.length,490);assert.equal(result.summary.abilityIds.length,180);assert.equal(result.summary.itemIds.length,82);assert.equal(result.summary.completeSpeciesIds.length,213);
 assert.equal(new Set(v35slice.team.map(member=>member.speciesId)).size,213);assert.ok(v35slice.team.some(member=>member.speciesId==='gourgeist-small'));assert.ok(v35slice.team.some(member=>member.speciesId==='gourgeist-large'));assert.ok(v35slice.team.some(member=>member.speciesId==='gourgeist-jumbo'));assert.ok(!v35slice.team.some(member=>['aegislash-blade','aegislash-shield','lycanroc'].includes(member.speciesId)));
 const ditto=v35slice.team.find(member=>member.speciesId==='ditto');assert.deepEqual(ditto.moveIds,['transform']);
 const broken=structuredClone(v35slice);broken.team.find(member=>member.speciesId==='ditto').moveIds=['transform','transform'];assert.match(validateV35(broken).problems.join('\n'),/ditto requires 1 distinct move/);
});
