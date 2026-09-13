import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

test('schema-3 Double applies Tailwind to waiting ally Speed in the same turn',()=>{
 const progression=createV3BetaProgression(v3Catalog),decidueye=progression.builds.find(entry=>entry.monId==='v3-mon-decidueye'),blastoise=progression.builds.find(entry=>entry.monId==='v3-mon-blastoise');
 decidueye.moveIds=['tailwind','brave-bird','hex','u-turn'];blastoise.statPoints={hp:32,atk:0,def:2,spa:32,spd:0,spe:0};
 let state={schemaVersion:3,seed:719,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode:'double',difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:[decidueye.buildId,blastoise.buildId,progression.builds[0].buildId,progression.builds[2].buildId]},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const battle=state.battleV3.battle,commands=[{kind:'move',actorId:'A-0',moveId:'tailwind'},{kind:'move',actorId:'A-1',moveId:'water-spout'}];
 result=applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands},v3Catalog);assert.equal(result.ok,true);
 const events=result.state.battleV3.lastEvents,tailwind=events.find(event=>event.kind==='sideConditionApplied'&&event.condition==='tailwind'),allyMove=events.find(event=>event.kind==='moveStarted'&&event.actorId==='A-1');
 assert.equal(tailwind.side,'A');assert.equal(tailwind.remaining,4);assert.equal(allyMove.speed,battle.sides.A.roster[1].stats.spe*2);assert.equal(result.state.battleV3.battle.sides.A.conditions.tailwind.remaining,3);
 const starts=events.filter(event=>event.kind==='moveStarted').map(event=>event.actorId),slowerFoe=battle.sides.B.roster.find(unit=>battle.sides.B.active.includes(unit.actorId)&&unit.stats.spe>battle.sides.A.roster[1].stats.spe&&unit.stats.spe<allyMove.speed&&starts.indexOf(unit.actorId)>starts.indexOf('A-0'));
 assert.ok(slowerFoe);assert.ok(starts.indexOf('A-0')<starts.indexOf('A-1'));assert.ok(starts.indexOf('A-1')<starts.indexOf(slowerFoe.actorId));
});
