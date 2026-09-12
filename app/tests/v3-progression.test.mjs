import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyV3ProgressionAction,createV3BetaProgression,v3TrainingView,validateV3Build,validateV3Team} from '../server/v3-progression.mjs';

const fresh=()=>createV3BetaProgression(v3Catalog);

test('schema-3 beta progression starts with six legal owned Mon, builds and one team',()=>{
 const state=fresh();assert.equal(state.mons.length,6);assert.equal(state.builds.length,6);assert.equal(state.teams[0].buildIds.length,6);assert.deepEqual(state.builds.flatMap(build=>validateV3Build(build,state,v3Catalog)),[]);assert.deepEqual(validateV3Team(state.teams[0],state,v3Catalog),[]);
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
