import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['howl','decorate','growth','flash','memento','ominous-wind','signal-beam','hurricane','chilly-reception','weather-ball','earthquake','expanding-force','ice-spinner','misty-explosion','rising-voltage','steel-roller','terrain-pulse','aurora-veil'];
const support=['tackle','brick-break'];
const ids=[...promoted,...support],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1800,maxHp:1800,stats:{hp:1800,atk:180,def:150,spa:180,spd:150,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']}),unit('b3')];
 return {id:`wave22-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:22,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},extra={})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100,...extra});
const reverseAction=(moveId,target={side:'A',slot:0},extra={})=>({kind:'move',side:'B',actorId:'b1',moveId,target,priority:manifests.moves[moveId].priority,speed:100,...extra});
const damageTo=(result,id='b1')=>result.events.find(event=>event.kind==='damage'&&event.targetId===id&&event.source!=='self-sacrifice');
const evidence={single:['r3-move-hooks-wave22:single'],double:['r3-move-hooks-wave22:double']};
const setAbility=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.abilityId=id;actor.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const setItem=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.itemId=id;actor.itemState=createHeldItemState(id);actor.passiveEffects=compilePassiveEffects({itemId:id,manifests});};

test('r3-move-hooks-wave22:single all 18 declarations use Wave 22 evidence and shared handlers',()=>{
 assert.equal(promoted.length,18);assert.equal(new Set(promoted).size,18);
 for(const id of promoted){const manifest=manifests.moves[id];assert.ok(manifest,`${id}: manifest`);assert.deepEqual(manifest.testEvidence,evidence,`${id}: evidence`);assert.equal(manifest.handlers[0].id,'spend-pp',`${id}: spends PP`);}
 assert.deepEqual(manifests.moves.howl.tags,['sound']);assert.deepEqual(manifests.moves['weather-ball'].tags,['bullet']);assert.deepEqual(manifests.moves['terrain-pulse'].tags,['pulse']);
 assert.equal(manifests.moves.earthquake.targetMode,'allAdjacent');assert.equal(manifests.moves['misty-explosion'].targetMode,'allAdjacent');assert.equal(manifests.moves['expanding-force'].handlers[1].id,'prepare-field-move');
 assert.ok(manifests.moves['brick-break'].handlers.find(entry=>entry.id==='break-side-screens').params.conditions.includes('aurora-veil'));
 assert.ok(manifests.items['light-clay'].handlers[0].params.conditions.includes('aurora-veil'));assert.ok(manifests.abilities.infiltrator.handlers[0].params.conditions.includes('aurora-veil'));
});

test('ally/stat primitives cover Howl, Decorate, sun Growth, Flash, and hit-gated Memento sacrifice',()=>{
 let battle=fixture('double'),result=resolveMove(battle,action('howl',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.atk,1);assert.equal(result.battle.sides.A.roster[1].stages.atk,1);
 battle=fixture('double');setAbility(battle,'A',1,'soundproof');result=resolveMove(battle,action('howl',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.atk,1);assert.equal(result.battle.sides.A.roster[1].stages.atk,0);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.targetId==='a2'));
 result=resolveMove(fixture('double'),action('decorate',{side:'A',slot:1}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[1].stages.atk,2);assert.equal(result.battle.sides.A.roster[1].stages.spa,2);
 battle=fixture();battle.field.weather={id:'sun',remaining:5};result=resolveMove(battle,action('growth',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stages.atk,2);assert.equal(result.battle.sides.A.roster[0].stages.spa,2);
 result=resolveMove(fixture(),action('flash'),{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].stages.accuracy,-1);
 battle=fixture();battle.sides.A.roster[0].stages.accuracy=-6;battle.sides.B.roster[0].stages.evasion=6;result=resolveMove(battle,action('memento'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,1800);assert.equal(result.battle.sides.B.roster[0].stages.atk,0);
 result=resolveMove(fixture(),action('memento'),{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,0);assert.equal(result.battle.sides.B.roster[0].stages.atk,-2);assert.equal(result.battle.sides.B.roster[0].stages.spa,-2);
});

test('secondary and weather accuracy composition covers Ominous Wind, Signal Beam, and Hurricane',()=>{
 let result=resolveMove(fixture(),action('ominous-wind'),{nextRandom:()=>0});for(const stat of ['atk','def','spa','spd','spe'])assert.equal(result.battle.sides.A.roster[0].stages[stat],1);assert.ok(damageTo(result)?.amount>0);
 result=resolveMove(fixture(),action('signal-beam'),{nextRandom:()=>0});assert.ok(result.battle.sides.B.roster[0].volatiles.confusion);
 let battle=fixture();battle.field.weather={id:'rain',remaining:5};battle.sides.A.roster[0].stages.accuracy=-6;battle.sides.B.roster[0].stages.evasion=6;result=resolveMove(battle,action('hurricane'),{nextRandom:()=>.999});assert.ok(damageTo(result)?.amount>0);assert.equal(result.events.some(event=>event.kind==='moveMissed'),false);
 battle=fixture();battle.field.weather={id:'sun',remaining:5};result=resolveMove(battle,action('hurricane'),{nextRandom:()=>.75});assert.ok(result.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===50));
 battle=fixture();battle.sides.B.roster[0].volatiles['two-turn-move']={id:'two-turn-move',moveId:'fly',semiInvulnerable:'airborne'};result=resolveMove(battle,action('hurricane'),{nextRandom:()=>0});assert.ok(damageTo(result)?.amount>0,'Hurricane hits airborne targets');
});

test('field move preparation generically rewrites Weather Ball, Terrain Pulse, and Expanding Force',()=>{
 let battle=fixture();battle.field.weather={id:'rain',remaining:5};let result=resolveMove(battle,action('weather-ball'),{nextRandom:()=>.999}),modified=result.events.find(event=>event.kind==='moveFieldModified');assert.deepEqual({sourceKind:modified.sourceKind,sourceId:modified.sourceId,fromType:modified.fromType,toType:modified.toType,fromPower:modified.fromPower,toPower:modified.toPower},{sourceKind:'weather',sourceId:'rain',fromType:'normal',toType:'water',fromPower:50,toPower:100});assert.ok(damageTo(result)?.amount>0);
 battle=fixture();battle.field.terrain={id:'misty',remaining:5};result=resolveMove(battle,action('terrain-pulse'),{nextRandom:()=>.999});modified=result.events.find(event=>event.kind==='moveFieldModified');assert.equal(modified.toType,'fairy');assert.equal(modified.toPower,100);
 battle=fixture('double');battle.field.terrain={id:'psychic',remaining:5};result=resolveMove(battle,action('expanding-force'),{nextRandom:()=>.999});modified=result.events.find(event=>event.kind==='moveFieldModified');assert.equal(modified.toPower,120);assert.equal(modified.toTargetMode,'allAdjacentFoes');assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['b1','b2']));
 battle=fixture('double');battle.field.terrain={id:'psychic',remaining:5};battle.sides.A.roster[0].types=['flying'];result=resolveMove(battle,action('expanding-force'),{nextRandom:()=>.999});assert.equal(result.events.some(event=>event.kind==='moveFieldModified'),false);assert.deepEqual(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId),['b1']);
});

test('terrain-aware power and clearing cover Rising Voltage, Steel Roller, Ice Spinner, and Misty Explosion',()=>{
 let plain=resolveMove(fixture(),action('rising-voltage'),{nextRandom:()=>.999});assert.equal(plain.events.find(event=>event.kind==='powerResolved')?.power,70);
 let battle=fixture();battle.field.terrain={id:'electric',remaining:5};let result=resolveMove(battle,action('rising-voltage'),{nextRandom:()=>.999});assert.equal(result.events.find(event=>event.kind==='powerResolved')?.power,140);assert.ok(damageTo(result).amount>damageTo(plain).amount);
 battle=fixture();const beforePp=battle.sides.A.roster[0].pp['steel-roller'];result=resolveMove(battle,action('steel-roller'),{nextRandom:()=>.999});assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='fieldRequirement'));assert.equal(result.battle.sides.A.roster[0].pp['steel-roller'],beforePp-1);assert.equal(result.events.some(event=>event.kind==='damage'),false);
 battle=fixture();battle.field.terrain={id:'grassy',remaining:5};result=resolveMove(battle,action('steel-roller'),{nextRandom:()=>.999});assert.ok(damageTo(result)?.amount>0);assert.equal(result.battle.field.terrain,undefined);assert.ok(result.events.some(event=>event.kind==='terrainEnded'&&event.reason==='clearedByMove'));
 battle=fixture();battle.field.terrain={id:'electric',remaining:5};battle.sides.A.roster[0].stages.accuracy=-6;battle.sides.B.roster[0].stages.evasion=6;result=resolveMove(battle,action('ice-spinner'),{nextRandom:()=>.999});assert.equal(result.battle.field.terrain.id,'electric','miss leaves terrain intact');
 battle=fixture();battle.field.terrain={id:'electric',remaining:5};result=resolveMove(battle,action('ice-spinner'),{nextRandom:()=>0});assert.equal(result.battle.field.terrain,undefined);
 battle=fixture('double');battle.field.terrain={id:'misty',remaining:5};result=resolveMove(battle,action('misty-explosion'),{nextRandom:()=>.999});assert.equal(result.events.find(event=>event.kind==='moveFieldModified')?.toPower,150);assert.equal(result.battle.sides.A.roster[0].hp,0);assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage'&&event.targetId!=='a1').map(event=>event.targetId)),new Set(['a2','b1','b2']));
});

test('Earthquake composes with all-adjacent targeting, grassy weakening, and underground double damage',()=>{
 let battle=fixture('double');battle.sides.B.roster[0].volatiles['two-turn-move']={id:'two-turn-move',moveId:'dig',semiInvulnerable:'underground'};let result=resolveMove(battle,action('earthquake'),{nextRandom:()=>.999});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['a2','b1','b2']));assert.equal(damageTo(result,'b1').breakdown.semiInvulnerabilityModifier?.multiplier,2);
 battle=fixture();battle.field.terrain={id:'grassy',remaining:5};result=resolveMove(battle,action('earthquake'),{nextRandom:()=>.999});assert.equal(damageTo(result).breakdown.terrainPowerModifier,.5);
});

test('Chilly Reception can pivot without damage while starting snow',()=>{
 const battle=fixture(),result=resolveMove(battle,action('chilly-reception',{side:'A',slot:0},{switchToId:'a3'}),{nextRandom:()=>.999});assert.equal(result.battle.field.weather.id,'snow');assert.equal(result.battle.field.weather.remaining,5);assert.deepEqual(result.battle.sides.A.active,['a3']);assert.ok(result.events.some(event=>event.kind==='switchOut'&&event.pivot===true));assert.ok(result.events.some(event=>event.kind==='switchIn'&&event.actorId==='a3'&&event.pivot===true));
});

test('Aurora Veil requires snow, uses Light Clay, reduces once, supports Infiltrator, and is breakable',()=>{
 let battle=fixture(),before=battle.sides.A.roster[0].pp['aurora-veil'],result=resolveMove(battle,action('aurora-veil',{side:'A',slot:0}),{nextRandom:()=>.999});assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='fieldRequirement'));assert.equal(result.battle.sides.A.roster[0].pp['aurora-veil'],before-1);
 battle=fixture();battle.field.weather={id:'snow',remaining:5};setItem(battle,'A',0,'light-clay');result=resolveMove(battle,action('aurora-veil',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.conditions['aurora-veil'].remaining,8);const veiled=result.battle;
 const baseline=resolveMove(fixture(),reverseAction('tackle'),{nextRandom:()=>.999});const reduced=resolveMove(veiled,reverseAction('tackle'),{nextRandom:()=>.999});assert.ok(damageTo(baseline,'a1').amount>damageTo(reduced,'a1').amount);assert.equal(damageTo(reduced,'a1').breakdown.sideConditionModifiers.filter(x=>x.kind==='screen-damage-reduction').length,1);
 battle=structuredClone(veiled);setAbility(battle,'B',0,'infiltrator');const bypass=resolveMove(battle,reverseAction('tackle'),{nextRandom:()=>.999});assert.equal(damageTo(bypass,'a1').amount,damageTo(baseline,'a1').amount);
 battle=structuredClone(veiled);result=resolveMove(battle,reverseAction('brick-break'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.conditions['aurora-veil'],undefined);const ended=result.events.findIndex(event=>event.kind==='sideConditionEnded'&&event.condition==='aurora-veil'),damage=result.events.findIndex(event=>event.kind==='damage'&&event.targetId==='a1');assert.ok(ended>=0&&damage>ended,'Brick Break removes Aurora Veil before damage');
});
