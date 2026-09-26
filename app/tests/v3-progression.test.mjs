import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyV3ProgressionAction,createV3BetaProgression,v3TrainingView,validateV3Build,validateV3Team} from '../server/v3-progression.mjs';

const fresh=()=>createV3BetaProgression(v3Catalog);

test('schema-3 beta progression starts with six legal owned Mon, builds and five switchable teams',()=>{
 const state=fresh();assert.equal(state.mons.length,6);assert.equal(state.builds.length,6);assert.equal(state.teams.length,5);assert.equal(state.activeTeamId,state.teams[0].teamId);assert.equal(state.teams[0].buildIds.length,6);assert.deepEqual(state.builds.flatMap(build=>validateV3Build(build,state,v3Catalog)),[]);assert.deepEqual(validateV3Team(state.teams[0],state,v3Catalog),[]);
});

test('schema-3 build validator enforces 66/32, learnset, Ability and enabled item',()=>{
 const state=fresh(),base=state.builds[0];
 assert.ok(validateV3Build({...base,statPoints:{...base.statPoints,hp:3}},state,v3Catalog).includes('STAT_POINTS_INVALID'));
 assert.ok(validateV3Build({...base,moveIds:['water-spout',...base.moveIds.slice(1)]},state,v3Catalog).includes('MOVE_ILLEGAL'));
 assert.ok(validateV3Build({...base,abilityId:'torrent'},state,v3Catalog).includes('ABILITY_ILLEGAL'));
 assert.ok(validateV3Build({...base,itemId:'missing'},state,v3Catalog).includes('ITEM_ILLEGAL'));
});

test('schema-3 team validator applies Species Clause and Item Clause',()=>{
 const state=fresh(),team=state.teams[0],duplicateBuild=structuredClone(state.builds[0]);duplicateBuild.buildId='duplicate';state.builds.push(duplicateBuild);
 const speciesDuplicate={...team,buildIds:[team.buildIds[0],duplicateBuild.buildId,...team.buildIds.slice(2)]};assert.ok(validateV3Team(speciesDuplicate,state,v3Catalog).includes('SPECIES_CLAUSE'));
 const itemDuplicate=structuredClone(state);itemDuplicate.builds[1].itemId=itemDuplicate.builds[0].itemId;assert.ok(validateV3Team(team,itemDuplicate,v3Catalog).includes('ITEM_CLAUSE'));
});

test('schema-3 build actions use optimistic revisions and preserve input state',()=>{
 const state=fresh(),before=structuredClone(state),base=state.builds[0],draft={...structuredClone(base),name:'Reviewed Beta Build'},saved=applyV3ProgressionAction(state,{type:'buildV3.save',expectedRevision:1,build:draft},v3Catalog);
 assert.equal(saved.ok,true);assert.equal(saved.build.revision,2);assert.equal(saved.progression.revision,2);assert.deepEqual(state,before);assert.equal(applyV3ProgressionAction(saved.progression,{type:'buildV3.save',expectedRevision:1,build:draft},v3Catalog).code,'STALE_REVISION');
});

test('schema-3 training view is detached and contains dual-type display data',()=>{
 const state=fresh(),view=v3TrainingView(state,v3Catalog),venusaur=view.species.find(species=>species.id==='venusaur');assert.deepEqual(venusaur.types,['grass','poison']);view.builds[0].name='mutated';assert.notEqual(state.builds[0].name,'mutated');
});

test('schema-3 Mega-base complete species can build from their full promoted learnset and Abilities',()=>{
 const state=fresh(),steelix=v3Catalog.speciesById.steelix,mon={monId:'v3-mon-steelix-complete',speciesId:'steelix',ownership:'permanent'},build={buildId:'v3-build-steelix-complete',monId:mon.monId,name:'Steelix Complete',natureId:'brave',statPoints:{hp:32,atk:32,def:0,spa:0,spd:2,spe:0},moveIds:['head-smash','heavy-slam','curse','sleep-talk'],abilityId:'rock-head',itemId:'steelixite',revision:1};
 state.mons.push(mon);state.builds.push(build);assert.deepEqual(validateV3Build(build,state,v3Catalog),[]);assert.ok(v3Catalog.movesById['head-smash']?.enabledForBattle);assert.ok(v3Catalog.abilitiesById['rock-head']?.enabledForBattle);
 const heracross=v3Catalog.speciesById.heracross;assert.ok(heracross.moveIds.includes('megahorn'));assert.ok(v3Catalog.movesById.megahorn?.enabledForBattle);assert.ok(v3Catalog.abilitiesById.moxie?.enabledForBattle);
 const alakazam=v3Catalog.speciesById.alakazam;assert.ok(alakazam.moveIds.includes('future-sight'));assert.ok(v3Catalog.movesById['future-sight']?.enabledForBattle);assert.ok(v3Catalog.abilitiesById['magic-guard']?.enabledForBattle);const garchomp=v3Catalog.speciesById.garchomp;assert.ok(garchomp.moveIds.includes('earthquake'));assert.ok(garchomp.abilityIds.includes('sand-veil'));assert.ok(v3Catalog.abilitiesById['rough-skin']?.enabledForBattle);
});


test("schema-3 build validator supports Ditto's single legal Transform without fake moves",()=>{
 const state=fresh(),species=v3Catalog.speciesById.ditto,defaults=species.defaultBuild,mon={monId:'v3-mon-ditto-contract',speciesId:'ditto',ownership:'permanent'},build={buildId:'v3-build-ditto-contract',monId:mon.monId,name:'Ditto Contract',natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};
 state.mons.push(mon);state.builds.push(build);assert.deepEqual(species.moveIds,['transform']);assert.deepEqual(build.moveIds,['transform']);assert.deepEqual(validateV3Build(build,state,v3Catalog),[]);assert.ok(validateV3Build({...build,moveIds:['transform','transform']},state,v3Catalog).includes('MOVE_COUNT_INVALID'));
});


test('schema-3 active team can switch without rewriting team builds',()=>{
 const state=fresh(),target=state.teams[2],result=applyV3ProgressionAction(state,{type:'teamV3.activate',teamId:target.teamId},v3Catalog);assert.equal(result.ok,true);assert.equal(result.progression.activeTeamId,target.teamId);assert.deepEqual(result.progression.teams[2].buildIds,target.buildIds);assert.equal(state.activeTeamId,state.teams[0].teamId);
});


test('team drafts persist composition immediately even when competitive Item Clause still needs fixing',()=>{
 const state=fresh(),species=v3Catalog.species.find(entry=>!state.mons.some(mon=>mon.speciesId===entry.id)),defaults=species.defaultBuild,mon={monId:'draft-mon',speciesId:species.id,ownership:'permanent'},build={buildId:'draft-build',monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:'leftovers',revision:1};state.mons.push(mon);state.builds.push(build);const team=structuredClone(state.teams[0]);team.buildIds[1]=build.buildId;assert.deepEqual(validateV3Team(team,state,v3Catalog),['ITEM_CLAUSE']);const saved=applyV3ProgressionAction(state,{type:'teamV3.save',expectedRevision:team.revision,team},v3Catalog);assert.equal(saved.ok,true);assert.deepEqual(saved.team.buildIds,team.buildIds);assert.deepEqual(validateV3Team(saved.team,saved.progression,v3Catalog),['ITEM_CLAUSE']);
});
