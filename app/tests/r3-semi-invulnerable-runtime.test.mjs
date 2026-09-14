import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattleAction} from '../server/v3-battle-actions.mjs';

function startWithSpecies(speciesId,moveIds,{mode='single',seed=1553}={}){
 const progression=createV3BetaProgression(v3Catalog),existing=progression.builds.find(entry=>entry.monId===`v3-mon-${speciesId}`);let build=existing;
 if(!build){const species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild,mon={monId:`v3-mon-${speciesId}`,speciesId,ownership:'permanent'};progression.mons.push(mon);build={buildId:`v3-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};progression.builds.push(build);}
 build.moveIds=[...moveIds];const others=progression.teams[0].buildIds.filter(id=>id!==build.buildId);progression.teams[0].buildIds=[build.buildId,...others.slice(0,5)];
 let state={schemaVersion:3,seed,progressionV3:progression},result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode,difficulty:'normal'},v3Catalog);assert.equal(result.ok,true);state=result.state;const pick=mode==='double'?4:3;result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds:progression.teams[0].buildIds.slice(0,pick)},v3Catalog);assert.equal(result.ok,true);state=result.state;
 const battle=state.battleV3.battle,actor=battle.sides.A.roster.find(unit=>unit.actorId===battle.sides.A.active[0]);assert.equal(actor.speciesId,speciesId);actor.stats.spe=999;actor.stages.accuracy=6;
 if(mode==='double'){const ally=battle.sides.A.roster.find(unit=>unit.actorId===battle.sides.A.active[1]);ally.buildSnapshot.moveIds=['protect'];ally.pp={protect:16};}
 return state;
}
function command(state,commands){const battle=state.battleV3.battle;return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands},v3Catalog);}

for(const mode of ['single','double'])test(`schema-3 ${mode} auto-locks Fly commitment and spends PP only once`,()=>{
 let state=startWithSpecies('charizard',['fly','protect','blast-burn','sunny-day'],{mode,seed:1561}),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],target={side:'B',slot:0},actor=battle.sides.A.roster.find(unit=>unit.actorId===actorId),beforePp=actor.pp.fly,beforeHp=battle.sides.B.roster[0].hp;
 for(const foeId of battle.sides.B.active){const foe=battle.sides.B.roster.find(unit=>unit.actorId===foeId);foe.buildSnapshot.moveIds=['tailwind'];foe.pp={tailwind:24};}
 const first=[{kind:'move',actorId,moveId:'fly',target}];if(mode==='double')first.push({kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'});let result=command(state,first);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;actor=battle.sides.A.roster.find(unit=>unit.actorId===actorId);assert.equal(actor.volatiles['two-turn-move']?.semiInvulnerable,'airborne');assert.equal(actor.pp.fly,beforePp-1);assert.equal(battle.sides.B.roster[0].hp,beforeHp);
 const second=[{kind:'move',actorId,moveId:'protect'}];if(mode==='double')second.push({kind:'move',actorId:battle.sides.A.active[1],moveId:'protect'});result=command(state,second);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;actor=battle.sides.A.roster.find(unit=>unit.actorId===actorId);assert.equal(actor.volatiles['two-turn-move'],undefined);assert.equal(actor.pp.fly,beforePp-1);assert.ok(battle.sides.B.roster[0].hp<beforeHp);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='twoTurnMoveReleased'&&event.semiInvulnerable==='airborne'));
});

test('schema-3 semi-invulnerable target causes an ordinary AI attack to miss',()=>{
 let state=startWithSpecies('charizard',['fly','protect','blast-burn','sunny-day'],{seed:1571}),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],foe=battle.sides.B.roster.find(unit=>unit.actorId===battle.sides.B.active[0]);foe.buildSnapshot.moveIds=['aerial-ace'];foe.pp={'aerial-ace':32};foe.stats.spe=1;
 const result=command(state,[{kind:'move',actorId,moveId:'fly',target:{side:'B',slot:0}}]);assert.equal(result.ok,true);assert.ok(result.state.battleV3.lastEvents.some(event=>event.kind==='moveMissed'&&event.targetId===actorId&&event.reason==='semiInvulnerable'&&event.semiInvulnerable==='airborne'));
});

test('schema-3 Phantom Force release breaks an active Protect before damage',()=>{
 let state=startWithSpecies('decidueye',['phantom-force','protect','brave-bird','defog'],{seed:1583}),battle=state.battleV3.battle,actorId=battle.sides.A.active[0],targetId=battle.sides.B.active[0],foe=battle.sides.B.roster.find(unit=>unit.actorId===targetId);foe.buildSnapshot.moveIds=['tailwind'];foe.pp={tailwind:24};
 let result=command(state,[{kind:'move',actorId,moveId:'phantom-force',target:{side:'B',slot:0}}]);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;foe=battle.sides.B.roster.find(unit=>unit.actorId===targetId);foe.volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};const hp=foe.hp;
 result=command(state,[{kind:'move',actorId,moveId:'protect'}]);assert.equal(result.ok,true);state=result.state;battle=state.battleV3.battle;foe=battle.sides.B.roster.find(unit=>unit.actorId===targetId);assert.ok(foe.hp<hp);assert.equal(foe.volatiles.protect,undefined);assert.ok(state.battleV3.lastEvents.some(event=>event.kind==='protectionBroken'&&event.moveId==='phantom-force'));
});
