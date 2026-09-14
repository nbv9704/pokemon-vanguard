import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function startSingle(speciesId,moveId){
 const progression=createV3BetaProgression(v3Catalog),build=progression.builds.find(entry=>entry.monId===`v3-mon-${speciesId}`);
 assert.ok(build);build.moveIds=[moveId,...build.moveIds.filter(id=>id!==moveId).slice(0,3)];
 progression.teams[0].buildIds=[build.buildId,...progression.teams[0].buildIds.filter(id=>id!==build.buildId)];
 let state={schemaVersion:3,seed:1241,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:progression.teams[0].buildIds.slice(0,3)},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const battle=state.battleV3.battle,actor=battle.sides.A.roster.find(unit=>unit.actorId===battle.sides.A.active[0]);assert.equal(actor.speciesId,speciesId);actor.stats.spe=999;
 return state;
}

const hazard=(id,layers=1,order=1)=>({id,layers,order,sourceActorId:'B-0',sourceMoveId:id});

test('schema-3 Rapid Spin clears the player hazards and Leech Seed after a real hit',()=>{
 let state=startSingle('blastoise','rapid-spin'),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],actor=battle.sides.A.roster.find(unit=>unit.actorId===actorId);
 battle.sides.A.conditions.spikes=hazard('spikes',2);battle.sides.A.conditions['stealth-rock']=hazard('stealth-rock',1,2);actor.volatiles['leech-seed']={id:'leech-seed',sourceId:'leech-seed',sourceSide:'B',sourceSlot:0};
 const result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId,moveId:'rapid-spin',target:{side:'B',slot:0}}]},v3Catalog);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 const after=battle.sides.A.roster.find(unit=>unit.actorId===actorId);assert.equal(battle.sides.A.conditions.spikes,undefined);assert.equal(battle.sides.A.conditions['stealth-rock'],undefined);assert.equal(after.volatiles['leech-seed'],undefined);assert.equal(after.stages.spe,1);
 assert.deepEqual(state.battleV3.lastEvents.filter(event=>event.kind==='hazardRemoved').map(event=>event.hazard),['spikes','stealth-rock']);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='volatileEnded'&&event.reason==='rapid-spin'));
});

test('schema-3 Defog clears both-side hazards, target screens and active terrain',()=>{
 let state=startSingle('decidueye','defog'),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],targetId=battle.sides.B.active[0];
 battle.sides.A.conditions['stealth-rock']=hazard('stealth-rock');battle.sides.B.conditions.spikes=hazard('spikes',3);battle.sides.B.conditions.reflect={id:'reflect',remaining:4};battle.sides.B.conditions['light-screen']={id:'light-screen',remaining:4};battle.sides.B.conditions.tailwind={id:'tailwind',remaining:3};battle.field??={};battle.field.terrain={id:'grassy',remaining:4,sourceActorId:actorId,sourceMoveId:'grassy-terrain'};
 const result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId,moveId:'defog',target:{side:'B',slot:0}}]},v3Catalog);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 assert.equal(battle.sides.A.conditions['stealth-rock'],undefined);assert.equal(battle.sides.B.conditions.spikes,undefined);assert.equal(battle.sides.B.conditions.reflect,undefined);assert.equal(battle.sides.B.conditions['light-screen'],undefined);assert.ok(battle.sides.B.conditions.tailwind);assert.equal(battle.field.terrain,undefined);
 assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='statStageChanged'&&event.targetId===targetId&&event.stat==='evasion'&&event.after===-1));assert.equal(state.battleV3.lastEvents.filter(event=>event.kind==='hazardRemoved').length,2);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='terrainEnded'&&event.reason==='defog'));
});
