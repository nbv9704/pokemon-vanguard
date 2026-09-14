import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function startSingle(mutator=()=>{}){
 const progression=createV3BetaProgression(v3Catalog);mutator(progression);
 let state={schemaVersion:3,seed:941,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'single',difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:progression.teams[0].buildIds.slice(0,3)},v3Catalog);assert.equal(result.ok,true);return result.state;
}

test('schema-3 server persists Spikes as an opposing side hazard',()=>{
 let state=startSingle(progression=>{const chesnaught=progression.builds.find(entry=>entry.monId==='v3-mon-chesnaught');chesnaught.moveIds=['spikes','drain-punch','leech-seed','spiky-shield'];progression.teams[0].buildIds=[chesnaught.buildId,...progression.teams[0].buildIds.filter(id=>id!==chesnaught.buildId)];});
 const battle=state.battleV3.battle,actorId=battle.sides.A.active[0],result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId,moveId:'spikes'}]},v3Catalog);assert.equal(result.ok,true);
 const hazard=result.state.battleV3.battle.sides.B.conditions.spikes,applied=result.state.battleV3.lastEvents.find(event=>event.kind==='hazardApplied'&&event.hazard==='spikes');assert.equal(hazard.layers,1);assert.equal(applied.side,'B');assert.equal(applied.maxLayers,3);
});

test('schema-3 server suspends on Stealth Rock entry KO and resumes after replacement',()=>{
 let state=startSingle(),battle=state.battleV3.battle;const reserve=battle.sides.A.roster.find(unit=>!battle.sides.A.active.includes(unit.actorId));reserve.hp=1;battle.sides.A.conditions['stealth-rock']={id:'stealth-rock',layers:1,order:1,sourceActorId:'B-0',sourceMoveId:'stealth-rock'};
 let result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'switch',actorId:battle.sides.A.active[0],toId:reserve.actorId}]},v3Catalog);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 assert.equal(battle.phase,'REPLACE');assert.ok(battle.pendingResolution);assert.equal(battle.sides.A.roster.find(unit=>unit.actorId===reserve.actorId).hp,0);assert.equal(state.battleV3.lastEvents.some(event=>event.kind==='turnSuspended'),true);assert.equal(state.battleV3.lastEvents.some(event=>event.kind==='hazardTriggered'&&event.hazard==='stealth-rock'),true);
 const replacement=battle.sides.A.roster.find(unit=>unit.hp>0&&!battle.sides.A.active.includes(unit.actorId));assert.ok(replacement);
 result=applyV3BattleAction(state,{type:'battleV3.replacements',phaseRevision:battle.phaseRevision,replacements:[{slot:0,actorId:replacement.actorId}]},v3Catalog);assert.equal(result.ok,true);assert.equal(result.state.battleV3.lastEvents.some(event=>event.kind==='turnResumed'),true);assert.equal(result.state.battleV3.battle.pendingResolution,undefined);
});

test('schema-3 server persists Toxic Spikes from Beedrill as a two-layer opposing hazard',()=>{
 let state=startSingle(progression=>{const beedrill=progression.builds.find(entry=>entry.monId==='v3-mon-beedrill');beedrill.moveIds=['toxic-spikes','u-turn','dual-wingbeat','protect'];progression.teams[0].buildIds=[beedrill.buildId,...progression.teams[0].buildIds.filter(id=>id!==beedrill.buildId)];});
 let battle=state.battleV3.battle,actorId=battle.sides.A.active[0],result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'move',actorId,moveId:'toxic-spikes'}]},v3Catalog);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 assert.equal(battle.sides.B.conditions['toxic-spikes'].layers,1);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='hazardApplied'&&event.hazard==='toxic-spikes'&&event.maxLayers===2));
});

test('schema-3 switch-ins receive Toxic Spikes status and grounded Beedrill absorbs the hazard',()=>{
 let state=startSingle(),battle=state.battleV3.battle;const leadId=battle.sides.A.active[0],blastoise=battle.sides.A.roster.find(unit=>unit.speciesId==='blastoise'),beedrill=battle.sides.A.roster.find(unit=>unit.speciesId==='beedrill');assert.ok(blastoise&&beedrill);
 battle.sides.A.conditions['toxic-spikes']={id:'toxic-spikes',layers:2,order:1,sourceActorId:battle.sides.B.active[0],sourceMoveId:'toxic-spikes'};
 let result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'switch',actorId:leadId,toId:blastoise.actorId}]},v3Catalog);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;assert.equal(battle.sides.A.roster.find(unit=>unit.actorId===blastoise.actorId).status.id,'bad-poison');assert.ok(battle.sides.A.conditions['toxic-spikes']);
 result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:[{kind:'switch',actorId:blastoise.actorId,toId:beedrill.actorId}]},v3Catalog);assert.equal(result.ok,true);assert.equal(result.state.battleV3.battle.sides.A.conditions['toxic-spikes'],undefined);assert.ok(result.state.battleV3.lastEvents.some(event=>event.kind==='hazardRemoved'&&event.hazard==='toxic-spikes'&&event.reason==='poison-type-absorption'));
});
