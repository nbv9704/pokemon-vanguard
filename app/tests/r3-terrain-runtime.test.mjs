import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function terrainBattle(mode='single'){
 const progression=createV3BetaProgression(v3Catalog),venusaur=progression.builds.find(entry=>entry.monId==='v3-mon-venusaur');
 venusaur.moveIds=['grassy-terrain','giga-drain','leech-seed','protect'];venusaur.itemId='terrain-extender';venusaur.natureId='timid';
 let state={schemaVersion:3,seed:719,progressionV3:progression};
 let result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode,difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const buildIds=mode==='double'?[venusaur.buildId,progression.builds.find(entry=>entry.monId==='v3-mon-blastoise').buildId,progression.builds[2].buildId,progression.builds[3].buildId]:progression.teams[0].buildIds.slice(0,3);
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds},v3Catalog);assert.equal(result.ok,true);
 return result.state;
}

function command(state,commands){
 const battle=state.battleV3.battle;
 return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands},v3Catalog);
}

test('schema-3 server persists Terrain Extender duration and applies Grassy end-turn healing',()=>{
 let state=terrainBattle(),battle=state.battleV3.battle,actorId=battle.sides.A.active[0];
 const result=command(state,[{kind:'move',actorId,moveId:'grassy-terrain'}]);assert.equal(result.ok,true);
 const started=result.state.battleV3.lastEvents.find(event=>event.kind==='terrainStarted'),heal=result.state.battleV3.lastEvents.find(event=>event.kind==='heal'&&event.targetId==='A-0'&&event.source==='terrain-healing');
 assert.equal(started.terrain,'grassy');assert.equal(started.remaining,8);assert.equal(started.sourceItemId,'terrain-extender');assert.ok(heal);assert.equal(result.state.battleV3.battle.field.terrain.remaining,7);
});

test('schema-3 Double stores one field terrain shared by both sides',()=>{
 let state=terrainBattle('double'),battle=state.battleV3.battle,commands=[{kind:'move',actorId:battle.sides.A.active[0],moveId:'grassy-terrain'},{kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'}];
 const result=command(state,commands);assert.equal(result.ok,true);const terrain=result.state.battleV3.battle.field.terrain,started=result.state.battleV3.lastEvents.find(event=>event.kind==='terrainStarted');assert.equal(started.terrain,'grassy');assert.equal(terrain.id,'grassy');assert.equal(terrain.remaining,7);assert.equal(result.state.battleV3.battle.sides.A.conditions.grassy,undefined);assert.equal(result.state.battleV3.battle.sides.B.conditions.grassy,undefined);
});
