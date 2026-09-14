import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function roomBattle(mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById.primarina,defaults=species.defaultBuild,mon={monId:'v3-mon-primarina',speciesId:'primarina',ownership:'permanent'},primarina={buildId:'v3-build-primarina',monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:['wonder-room','draining-kiss','stored-power','protect'],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(primarina);progression.teams[0].buildIds=[primarina.buildId,...progression.teams[0].buildIds.slice(0,5)];
 let state={schemaVersion:3,seed:1207,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode,difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const pick=mode==='double'?4:3,resultIds=progression.teams[0].buildIds.slice(0,pick);result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:resultIds},v3Catalog);assert.equal(result.ok,true);return result.state;
}
function command(state,commands){const battle=state.battleV3.battle;return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands},v3Catalog);}

test('schema-3 server promotes Primarina Wonder Room and persists its global five-turn field state',()=>{
 let state=roomBattle(),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],result=command(state,[{kind:'move',actorId,moveId:'wonder-room'}]);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 const started=state.battleV3.lastEvents.find(event=>event.kind==='roomStarted'&&event.room==='wonder-room');assert.equal(started.remaining,5);assert.equal(battle.field.rooms['wonder-room'].remaining,4);assert.equal(battle.sides.A.roster.find(unit=>unit.actorId===actorId).pp['wonder-room'],11);
 result=command(state,[{kind:'move',actorId,moveId:'wonder-room'}]);assert.equal(result.ok,true);assert.equal(result.state.battleV3.battle.field.rooms?.['wonder-room'],undefined);assert.ok(result.state.battleV3.lastEvents.some(event=>event.kind==='roomEnded'&&event.room==='wonder-room'&&event.reason==='recast'));
});

test('schema-3 Double stores Wonder Room once on the shared field instead of either side',()=>{
 const state=roomBattle('double'),battle=state.battleV3.battle,commands=[{kind:'move',actorId:battle.sides.A.active[0],moveId:'wonder-room'},{kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'}],result=command(state,commands);assert.equal(result.ok,true);
 const room=result.state.battleV3.battle.field.rooms['wonder-room'];assert.equal(room.id,'wonder-room');assert.equal(room.remaining,4);assert.equal(result.state.battleV3.battle.sides.A.conditions['wonder-room'],undefined);assert.equal(result.state.battleV3.battle.sides.B.conditions['wonder-room'],undefined);
});
