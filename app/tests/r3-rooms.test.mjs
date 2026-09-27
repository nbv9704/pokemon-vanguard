import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveActionQueue,stagedStat} from '../rules-v3/index.mjs';
import {applyDamageHit,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,passiveDamageModifiers,resolveMechanicsEndTurn,roomActive,speedWithWeather,wonderRoomDefenseBase} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const roomIds=['trick-room','wonder-room','magic-room'],supportIds=[...roomIds,'reflect','sunny-day','grassy-terrain'];
const moves=Object.fromEntries(allMoves.filter(move=>supportIds.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{'trick-room':8,'wonder-room':12,'magic-room':12,reflect:20,'sunny-day':8,'grassy-terrain':12},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`rooms-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:7,field:{},sides:{A:{active:a.slice(0,count).map(entry=>entry.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(entry=>entry.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const maxRoll=()=>{const rolls=[.99,.99];return {nextRandom:()=>rolls.shift()};};

for(const format of ['single','double'])test(`r3-rooms:${format} rooms coexist, last five turns, and recast toggles only the same room`,()=>{
 let battle=fixture(format),before=structuredClone(battle);
 for(const room of roomIds){const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:room},{});battle=result.battle;assert.equal(battle.field.rooms[room].remaining,5);assert.equal(result.events.at(-1).kind,'roomStarted');}
 assert.deepEqual(before.field,{});assert.deepEqual(Object.keys(battle.field.rooms).sort(),[...roomIds].sort());
 const recast=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'wonder-room'},{});assert.equal(recast.battle.field.rooms['wonder-room'],undefined);assert.ok(recast.battle.field.rooms['trick-room']);assert.ok(recast.battle.field.rooms['magic-room']);assert.equal(recast.events.at(-1).kind,'roomEnded');assert.equal(recast.events.at(-1).reason,'recast');assert.equal(recast.battle.sides.A.roster[0].pp['wonder-room'],10);
});

test('Wonder Room swaps defensive base stats before applying the requested defense stage',()=>{
 const battle=fixture();battle.field.rooms={'wonder-room':{id:'wonder-room',remaining:4}};const defender=battle.sides.B.roster[0];defender.stats.def=60;defender.stats.spd=180;defender.stages.def=2;defender.stages.spd=-2;
 assert.equal(wonderRoomDefenseBase(battle,defender,'def'),180);assert.equal(wonderRoomDefenseBase(battle,defender,'spd'),60);
 const physical={id:'physical-hit',type:'normal',category:'physical',power:80},special={...physical,id:'special-hit',category:'special'};
 const physicalHit=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:physical},maxRoll()).events[0],specialHit=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:special},maxRoll()).events[0];
 const expectedPhysicalDefense=stagedStat(180,2),expectedSpecialDefense=stagedStat(60,-2),plain=fixture();plain.sides.B.roster[0].stats.def=60;plain.sides.B.roster[0].stats.spd=180;plain.sides.B.roster[0].stages.def=2;plain.sides.B.roster[0].stages.spd=-2;
 assert.equal(physicalHit.breakdown.base,Math.floor(Math.floor(Math.floor(22*80*100/expectedPhysicalDefense)/50)+2));assert.equal(specialHit.breakdown.base,Math.floor(Math.floor(Math.floor(22*80*100/expectedSpecialDefense)/50)+2));
 assert.notEqual(physicalHit.amount,applyDamageHit(plain,{actorId:'a1',targetId:'b1',move:physical},maxRoll()).events[0].amount);
});

test('Magic Room suppresses current held-item passive effects but keeps Ability effects active',()=>{
 const battle=fixture();battle.field.rooms={'magic-room':{id:'magic-room',remaining:4}};const actor=battle.sides.A.roster[0];actor.hp=50;actor.passiveEffects=[...compilePassiveEffects({abilityId:'overgrow',manifests}),...compilePassiveEffects({itemId:'miracle-seed',manifests})];
 const mods=passiveDamageModifiers(actor,{type:'grass',category:'special'},battle);assert.deepEqual(mods.applied.map(entry=>entry.sourceKind),['ability']);assert.equal(mods.values[0],1.5);
 actor.passiveEffects=compilePassiveEffects({abilityId:'chlorophyll',manifests});battle.field.weather={id:'sun',remaining:4};assert.equal(speedWithWeather(100,actor,battle),200);
});

test('Magic Room suppresses Light Clay, weather rocks and Terrain Extender until it ends',()=>{
 const withMagic=itemId=>{const battle=fixture();battle.field.rooms={'magic-room':{id:'magic-room',remaining:4}};battle.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId,manifests});return battle;};
 assert.equal(resolveMove(withMagic('light-clay'),{kind:'move',side:'A',actorId:'a1',moveId:'reflect'},{}).battle.sides.A.conditions.reflect.remaining,5);
 assert.equal(resolveMove(withMagic('heat-rock'),{kind:'move',side:'A',actorId:'a1',moveId:'sunny-day'},{}).battle.field.weather.remaining,5);
 assert.equal(resolveMove(withMagic('terrain-extender'),{kind:'move',side:'A',actorId:'a1',moveId:'grassy-terrain'},{}).battle.field.terrain.remaining,5);
 const ordinary=fixture();ordinary.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'light-clay',manifests});assert.equal(resolveMove(ordinary,{kind:'move',side:'A',actorId:'a1',moveId:'reflect'},{}).battle.sides.A.conditions.reflect.remaining,8);
});

test('room timers tick independently and expire with generic roomEnded events',()=>{
 const battle=fixture();battle.phase='END_TURN';battle.field.rooms={'trick-room':{id:'trick-room',remaining:1},'wonder-room':{id:'wonder-room',remaining:2},'magic-room':{id:'magic-room',remaining:3}};
 const result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.field.rooms['trick-room'],undefined);assert.equal(result.battle.field.rooms['wonder-room'].remaining,1);assert.equal(result.battle.field.rooms['magic-room'].remaining,2);assert.deepEqual(result.events.filter(event=>event.kind==='roomEnded').map(event=>event.room),['trick-room']);
});

test('Trick Room is re-read after every action so waiting equal-priority actions reverse without rerolling',()=>{
 const battle=fixture('double'),actions=[
  {kind:'move',side:'A',actorId:'a1',moveId:'toggle',priority:1,speed:120},
  {kind:'move',side:'A',actorId:'a2',moveId:'wait',priority:0,speed:200},
  {kind:'move',side:'B',actorId:'b1',moveId:'wait',priority:0,speed:150},
  {kind:'move',side:'B',actorId:'b2',moveId:'wait',priority:0,speed:100},
 ],handler=(current,action)=>{const next=structuredClone(current);if(action.actorId==='a1'){next.field.rooms??={};next.field.rooms['trick-room']={id:'trick-room',remaining:5};}return {battle:next,events:[{kind:'handled',actorId:action.actorId}]};};
 const result=resolveActionQueue(battle,actions,{move:handler},{getSpeed:(_current,action)=>action.speed,isTrickRoom:current=>roomActive(current,'trick-room')});assert.equal(result.ok,true);assert.deepEqual(result.queue.map(action=>action.actorId),['a1','b2','b1','a2']);
});
