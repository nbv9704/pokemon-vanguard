import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyDamageHit,applyMajorStatus,applyVolatileStatus,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn,terrainDamageModifiers,unitIsGrounded} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['grassy-terrain','misty-terrain'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{'grassy-terrain':12,'misty-terrain':12},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`terrain-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(entry=>entry.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(entry=>entry.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const maxRoll=()=>{const rolls=[.99,.99];return {nextRandom:()=>rolls.shift()};};

test('r3-terrain:single terrain lasts five turns, Terrain Extender makes eight, and replacement is explicit',()=>{
 const base=fixture(),before=structuredClone(base),grassy=resolveMove(base,{kind:'move',side:'A',actorId:'a1',moveId:'grassy-terrain'},{});
 assert.deepEqual(base,before);assert.deepEqual(grassy.battle.field.terrain,{id:'grassy',remaining:5,sourceActorId:'a1',sourceMoveId:'grassy-terrain'});assert.equal(grassy.battle.sides.A.roster[0].pp['grassy-terrain'],11);
 const duplicate=resolveMove(grassy.battle,{kind:'move',side:'A',actorId:'a1',moveId:'grassy-terrain'},{});assert.equal(duplicate.events.at(-1).reason,'terrainAlreadyActive');assert.equal(duplicate.battle.field.terrain.remaining,5);assert.equal(duplicate.battle.sides.A.roster[0].pp['grassy-terrain'],10);
 const extended=fixture();extended.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'terrain-extender',manifests});
 const misty=resolveMove(extended,{kind:'move',side:'A',actorId:'a1',moveId:'misty-terrain'},{});assert.equal(misty.battle.field.terrain.remaining,8);assert.equal(misty.events.at(-1).sourceItemId,'terrain-extender');
 const replaced=resolveMove(misty.battle,{kind:'move',side:'A',actorId:'a1',moveId:'grassy-terrain'},{});assert.equal(replaced.events.at(-2).kind,'terrainEnded');assert.equal(replaced.events.at(-2).reason,'replaced');assert.equal(replaced.events.at(-1).terrain,'grassy');assert.equal(replaced.battle.field.terrain.remaining,8);
});

test('Grassy Terrain boosts grounded Grass attacks and halves quake-like base power against grounded targets',()=>{
 const grass={id:'grass-hit',type:'grass',category:'special',power:80},quake={id:'earthquake',type:'ground',category:'physical',power:100},battle=fixture();battle.field.terrain={id:'grassy',remaining:4};battle.sides.A.roster[0].types=['grass'];
 const boosted=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:grass},maxRoll()).events[0];assert.equal(boosted.breakdown.terrainModifiers[0].multiplier,5325/4096);assert.equal(boosted.breakdown.terrainPowerModifier,undefined);
 const flyingAttacker=fixture();flyingAttacker.field.terrain={id:'grassy',remaining:4};flyingAttacker.sides.A.roster[0].types=['grass','flying'];assert.equal(terrainDamageModifiers(flyingAttacker,flyingAttacker.sides.A.roster[0],flyingAttacker.sides.B.roster[0],grass).values.length,0);
 const softened=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:quake},maxRoll()).events[0];assert.equal(softened.breakdown.terrainPowerModifier,.5);
 const airborne=fixture();airborne.field.terrain={id:'grassy',remaining:4};airborne.sides.B.roster[0].types=['flying'];assert.equal(terrainDamageModifiers(airborne,airborne.sides.A.roster[0],airborne.sides.B.roster[0],quake).powerModifier,1);assert.equal(unitIsGrounded(airborne.sides.B.roster[0]),false);
});

test('Misty Terrain halves Dragon damage and blocks major status and confusion only for grounded targets',()=>{
 const dragon={id:'dragon-hit',type:'dragon',category:'special',power:80},battle=fixture();battle.field.terrain={id:'misty',remaining:4};battle.sides.A.roster[0].types=['dragon'];
 const reduced=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:dragon},maxRoll()).events[0];assert.equal(reduced.breakdown.terrainModifiers[0].kind,'grounded-dragon-reduction');assert.equal(reduced.breakdown.terrainModifiers[0].multiplier,.5);
 const status=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'sing',status:'sleep'},{nextRandom:()=>0});assert.equal(status.events[0].reason,'terrainBlocked');assert.equal(status.battle.sides.B.roster[0].status,null);
 const confused=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'confuse-ray',volatile:'confusion'},{nextRandom:()=>0});assert.equal(confused.events[0].reason,'terrainBlocked');assert.equal(confused.battle.sides.B.roster[0].volatiles.confusion,undefined);
 const airborne=fixture();airborne.field.terrain={id:'misty',remaining:4};airborne.sides.B.roster[0].types=['flying'];assert.equal(applyDamageHit(airborne,{actorId:'a1',targetId:'b1',move:dragon},maxRoll()).events[0].breakdown.terrainModifiers.length,0);
 const airborneStatus=applyMajorStatus(airborne,{actorId:'a1',targetId:'b1',moveId:'sing',status:'sleep'},{nextRandom:()=>0});assert.equal(airborneStatus.events[0].kind,'statusApplied');
});

test('r3-terrain:double Grassy Terrain heals grounded active Pokémon before its duration expires',()=>{
 const battle=fixture('double');battle.phase='END_TURN';battle.field.terrain={id:'grassy',remaining:1};battle.sides.A.roster[0].hp=120;battle.sides.A.roster[1].hp=120;battle.sides.A.roster[1].types=['flying'];battle.sides.B.roster[0].hp=150;
 const result=resolveMechanicsEndTurn(battle),heals=result.events.filter(event=>event.kind==='heal'&&event.source==='terrain-healing'),ended=result.events.find(event=>event.kind==='terrainEnded');
 assert.deepEqual(heals.map(event=>[event.targetId,event.amount]),[['a1',10],['b1',10]]);assert.equal(result.battle.sides.A.roster[0].hp,130);assert.equal(result.battle.sides.A.roster[1].hp,120);assert.equal(result.battle.sides.B.roster[0].hp,160);assert.equal(ended.terrain,'grassy');assert.equal(result.battle.field.terrain,undefined);
});
