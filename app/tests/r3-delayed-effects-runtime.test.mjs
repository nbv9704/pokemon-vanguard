import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function startWithSpecies(speciesId,moveIds,{mode='single',seed=1325}={}){
 const progression=createV3BetaProgression(v3Catalog),existing=progression.builds.find(entry=>entry.monId===`v3-mon-${speciesId}`);
 let build=existing;
 if(!build){
  const species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild,mon={monId:`v3-mon-${speciesId}`,speciesId,ownership:'permanent'};
  progression.mons.push(mon);build={buildId:`v3-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};progression.builds.push(build);
 }
 build.moveIds=[...moveIds];const others=progression.teams[0].buildIds.filter(id=>id!==build.buildId);progression.teams[0].buildIds=[build.buildId,...others.slice(0,5)];
 let state={schemaVersion:3,seed,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode,difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const pick=mode==='double'?4:3;result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:progression.teams[0].buildIds.slice(0,pick)},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const battle=state.battleV3.battle,actor=battle.sides.A.roster.find(unit=>unit.actorId===battle.sides.A.active[0]);assert.equal(actor.speciesId,speciesId);actor.stats.spe=999;for(const foeId of battle.sides.B.active){const foe=battle.sides.B.roster.find(unit=>unit.actorId===foeId);foe.buildSnapshot.moveIds=['tailwind'];foe.pp={tailwind:24};}return state;
}
function command(state,commands){const battle=state.battleV3.battle;return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands},v3Catalog);}

for(const mode of ['single','double'])test(`schema-3 ${mode} promotes Blastoise Yawn and resolves sleep on the following end turn`,()=>{
 let state=startWithSpecies('blastoise',['yawn','protect','water-spout','flip-turn'],{mode,seed:1331}),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],targetId=battle.sides.B.active[0];
 const firstCommands=[{kind:'move',actorId,moveId:'yawn',target:{side:'B',slot:0}}];if(mode==='double')firstCommands.push({kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'});
 let result=command(state,firstCommands);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;let target=battle.sides.B.roster.find(unit=>unit.actorId===targetId);
 assert.equal(target.volatiles.yawn?.remaining,1);assert.equal(target.status,null);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='delayedEffectScheduled'&&event.effect==='yawn'&&event.targetId===targetId));
 const secondCommands=[{kind:'move',actorId,moveId:'protect'}];if(mode==='double')secondCommands.push({kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'});
 result=command(state,secondCommands);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;target=battle.sides.B.roster.find(unit=>unit.actorId===targetId);
 assert.equal(target.volatiles.yawn,undefined);assert.equal(target.status?.id,'sleep');assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='delayedEffectResolved'&&event.effect==='yawn'&&event.targetId===targetId));
});

test('schema-3 promotes Primarina Perish Song, decrements on the use turn, and switching clears the user counter',()=>{
 let state=startWithSpecies('primarina',['perish-song','protect','draining-kiss','stored-power'],{seed:1349}),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],foeId=battle.sides.B.active[0];
 let result=command(state,[{kind:'move',actorId,moveId:'perish-song'}]);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 let user=battle.sides.A.roster.find(unit=>unit.actorId===actorId),foe=battle.sides.B.roster.find(unit=>unit.actorId===foeId);assert.equal(user.volatiles['perish-song']?.remaining,3);assert.equal(foe.volatiles['perish-song']?.remaining,3);assert.equal(state.battleV3.lastEvents.filter(event=>event.kind==='delayedEffectScheduled'&&event.effect==='perish-song').length,2);
 const replacementId=battle.sides.A.roster.find(unit=>unit.actorId!==actorId&&unit.hp>0).actorId;result=command(state,[{kind:'switch',actorId,toId:replacementId}]);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;
 user=battle.sides.A.roster.find(unit=>unit.actorId===actorId);const replacement=battle.sides.A.roster.find(unit=>unit.actorId===replacementId);foe=battle.sides.B.roster.find(unit=>unit.actorId===foeId);assert.equal(user.volatiles['perish-song'],undefined);assert.equal(replacement.volatiles['perish-song'],undefined);assert.equal(foe.volatiles['perish-song']?.remaining,2);
});
