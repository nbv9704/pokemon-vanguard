import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySwitch} from '../rules-v3/index.mjs';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveDelayedEffectsEndTurn,resolveMechanicsEndTurn,scheduleDelayedEffect} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const moves=Object.fromEntries(allMoves.filter(move=>['yawn','perish-song','protect'].includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{yawn:12,'perish-song':8,protect:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`delayed-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:17,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,speed:100,priority:0});

for(const format of ['single','double'])test(`r3-delayed-effects:${format} Yawn schedules for two residuals and then applies seeded sleep`,()=>{
 let battle=fixture(format),original=structuredClone(battle),used=resolveMove(battle,action('yawn'),{});battle=used.battle;
 assert.equal(battle.sides.B.roster[0].volatiles.yawn.remaining,2);assert.equal(used.events.at(-1).kind,'delayedEffectScheduled');assert.deepEqual(original.sides.B.roster[0].volatiles,{});
 let first=resolveDelayedEffectsEndTurn(battle);battle=first.battle;assert.equal(battle.sides.B.roster[0].volatiles.yawn.remaining,1);assert.equal(first.events[0].kind,'delayedEffectTick');assert.equal(battle.sides.B.roster[0].status,null);
 const second=resolveDelayedEffectsEndTurn(battle);battle=second.battle;assert.equal(battle.sides.B.roster[0].volatiles.yawn,undefined);assert.equal(battle.sides.B.roster[0].status.id,'sleep');assert.ok([1,2,3].includes(battle.sides.B.roster[0].status.turnsRemaining));assert.deepEqual(second.events.map(event=>event.kind),['delayedEffectResolved','statusApplied']);
});

test('Yawn is blocked by Protect, existing status, and grounded Electric Terrain but Misty Terrain waits until sleep resolution',()=>{
 let battle=fixture();battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};
 let result=resolveMove(battle,action('yawn'),{});assert.ok(result.events.some(event=>event.kind==='moveBlocked'));assert.equal(result.battle.sides.B.roster[0].volatiles.yawn,undefined);
 battle=fixture();battle.sides.B.roster[0].status={id:'poison'};result=resolveMove(battle,action('yawn'),{});assert.equal(result.events.at(-1).reason,'alreadyStatus');assert.equal(result.battle.sides.B.roster[0].volatiles.yawn,undefined);
 battle=fixture();battle.field.terrain={id:'electric',remaining:4};result=resolveMove(battle,action('yawn'),{});assert.equal(result.events.at(-1).reason,'terrainBlocked');assert.equal(result.battle.sides.B.roster[0].volatiles.yawn,undefined);
 battle=fixture();battle.field.terrain={id:'misty',remaining:4};result=resolveMove(battle,action('yawn'),{});assert.ok(result.battle.sides.B.roster[0].volatiles.yawn);let tick=resolveDelayedEffectsEndTurn(result.battle);tick=resolveDelayedEffectsEndTurn(tick.battle);assert.equal(tick.battle.sides.B.roster[0].status,null);assert.ok(tick.events.some(event=>event.kind==='statusFailed'&&event.reason==='terrainBlocked'));
});

test('switching clears delayed effects before they can resolve',()=>{
 let battle=fixture(),used=resolveMove(battle,action('yawn'),{});battle=used.battle;const switched=applySwitch(battle,'B','b1','b3');assert.equal(switched.ok,true);assert.deepEqual(switched.battle.sides.B.roster.find(unit=>unit.actorId==='b1').volatiles,{});
 const residual=resolveDelayedEffectsEndTurn(switched.battle);assert.equal(residual.battle.sides.B.roster.find(unit=>unit.actorId==='b1').status,null);assert.equal(residual.events.length,0);
});

for(const format of ['single','double'])test(`Perish Song ${format} schedules every current active and faints them at count zero`,()=>{
 let battle=fixture(format),used=resolveMove(battle,action('perish-song',undefined),{});battle=used.battle;const activeCount=format==='double'?4:2;
 assert.equal(used.events.filter(event=>event.kind==='delayedEffectScheduled').length,activeCount);assert.equal(used.events.filter(event=>event.kind==='delayedEffectScheduled').every(event=>event.count===4),true);
 for(let expected=3;expected>=1;expected--){const residual=resolveDelayedEffectsEndTurn(battle);battle=residual.battle;assert.equal(residual.events.filter(event=>event.kind==='delayedEffectTick').every(event=>event.count===expected),true);}
 const final=resolveDelayedEffectsEndTurn(battle);battle=final.battle;assert.equal(['A','B'].flatMap(side=>battle.sides[side].active).every(id=>battle.sides.A.roster.concat(battle.sides.B.roster).find(unit=>unit.actorId===id).hp===0),true);assert.equal(final.events.filter(event=>event.kind==='fainted').length,activeCount);
});

test('Perish Song does not duplicate existing counters and a switched replacement is not inherited',()=>{
 let battle=fixture('double'),used=resolveMove(battle,action('perish-song',undefined),{});battle=used.battle;const recast=resolveMove(battle,action('perish-song',undefined),{});assert.equal(recast.events.filter(event=>event.kind==='delayedEffectScheduled').length,0);assert.equal(recast.events.at(-1).reason,'noNewTarget');
 const switched=applySwitch(battle,'B','b1','b3');assert.equal(switched.ok,true);assert.equal(switched.battle.sides.B.roster.find(unit=>unit.actorId==='b1').volatiles['perish-song'],undefined);assert.equal(switched.battle.sides.B.roster.find(unit=>unit.actorId==='b3').volatiles['perish-song'],undefined);
});

test('mechanics end-turn resolves HP groups before delayed effects and keeps deterministic RNG state',()=>{
 let battle=fixture();battle.phase='END_TURN';battle=scheduleDelayedEffect(battle,{actorId:'a1',targetId:'b1',moveId:'yawn',effect:'yawn',turns:1}).battle;battle.sides.B.roster[0].hp=10;battle.sides.B.roster[0].status={id:'poison'};
 const before=structuredClone(battle),result=resolveMechanicsEndTurn(battle);assert.deepEqual(battle,before);assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.B.roster[0].status.id,'poison');assert.equal(result.battle.sides.B.roster[0].volatiles.yawn.remaining,1);assert.ok(result.events.some(event=>event.kind==='fainted'&&event.source==='major-status-residual'));
 const a=fixture(),b=fixture();const sa=scheduleDelayedEffect(a,{actorId:'a1',targetId:'b1',moveId:'yawn',effect:'yawn',turns:1}).battle,sb=scheduleDelayedEffect(b,{actorId:'a1',targetId:'b1',moveId:'yawn',effect:'yawn',turns:1}).battle,ra=resolveDelayedEffectsEndTurn(sa),rb=resolveDelayedEffectsEndTurn(sb);assert.deepEqual(ra,rb);
});
