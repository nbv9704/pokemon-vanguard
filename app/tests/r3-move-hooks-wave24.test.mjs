import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['false-swipe','focus-energy','dream-eater','fell-stinger','clangorous-soul','freeze-dry','acupressure','heal-pulse'];
const ids=[...promoted],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1800,maxHp:1800,stats:{hp:1800,atk:220,def:150,spa:220,spd:150,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']}),unit('b3')];
 return {id:`wave24-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:24,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},extra={})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100,...extra});
const damageTo=(result,id='b1')=>result.events.find(event=>event.kind==='damage'&&event.targetId===id&&event.source!=='hp-cost');
const evidence={single:['r3-move-hooks-wave24:single'],double:['r3-move-hooks-wave24:double']};
const setAbility=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.abilityId=id;actor.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};

test('r3-move-hooks-wave24:single all 8 declarations use Wave 24 evidence and generic mechanics',()=>{
 assert.equal(promoted.length,8);assert.equal(new Set(promoted).size,8);
 for(const id of promoted){const manifest=manifests.moves[id];assert.ok(manifest,`${id}: manifest`);assert.deepEqual(manifest.testEvidence,evidence,`${id}: evidence`);assert.equal(manifest.handlers[0].id,'spend-pp',`${id}: spends PP`);}
 assert.equal(manifests.moves['false-swipe'].damageProfile.minTargetHp,1);
 assert.equal(manifests.moves['focus-energy'].handlers[1].params.volatile,'focus-energy');
 assert.deepEqual(manifests.moves['freeze-dry'].damageProfile.typeEffectivenessOverrides,{water:2});
 assert.equal(manifests.moves['freeze-dry'].secondaryEffects,undefined,'Champions override removes Freeze-Dry secondary');
 assert.equal(manifests.moves.acupressure.targetMode,'adjacentAllyOrSelf');
 assert.equal(manifests.moves['heal-pulse'].handlers.at(-1).params.abilityBoostTag,'pulse');
});

test('False Swipe applies a non-lethal damage floor before survival abilities',()=>{
 const battle=fixture();battle.sides.B.roster[0].hp=20;battle.sides.B.roster[0].maxHp=20;battle.sides.B.roster[0].stats.hp=20;battle.sides.B.roster[0].stats.def=1;setAbility(battle,'B',0,'sturdy');
 const result=resolveMove(battle,action('false-swipe'),{nextRandom:()=>.999}),damage=damageTo(result);
 assert.equal(result.battle.sides.B.roster[0].hp,1);assert.equal(damage.amount,19);assert.equal(damage.breakdown.nonLethalFloor.minTargetHp,1);
 assert.equal(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='sturdy'),false,'Sturdy is not falsely consumed by non-lethal floor');
});

test('Focus Energy stores a reusable +2 critical-ratio volatile that feeds normal damage resolution',()=>{
 let battle=fixture();let plain=resolveMove(battle,action('false-swipe'),{nextRandom:()=>.4});assert.equal(damageTo(plain).breakdown.critical,1);
 const focused=resolveMove(battle,action('focus-energy',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(focused.battle.sides.A.roster[0].volatiles['focus-energy'].criticalRatioStages,2);
 const crit=resolveMove(focused.battle,action('false-swipe'),{nextRandom:()=>.4});assert.equal(damageTo(crit).breakdown.critical,1.5);
});

test('Dream Eater spends PP but fails on awake targets, then drains from sleeping targets',()=>{
 let battle=fixture();battle.sides.A.roster[0].hp=600;const before=battle.sides.A.roster[0].pp['dream-eater'];let result=resolveMove(battle,action('dream-eater'),{nextRandom:()=>.999});assert.equal(result.events.some(event=>event.kind==='damage'),false);assert.equal(result.battle.sides.A.roster[0].pp['dream-eater'],before-1);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='targetStatusRequirement'));
 battle=fixture();battle.sides.A.roster[0].hp=600;battle.sides.B.roster[0].status={id:'sleep',sourceId:'fixture',turnsRemaining:2};result=resolveMove(battle,action('dream-eater'),{nextRandom:()=>.999});assert.ok(damageTo(result).amount>0);assert.ok(result.battle.sides.A.roster[0].hp>600);assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='drain'));
});

test('Fell Stinger grants +3 Attack only when its own damaging hit KOs the target',()=>{
 let battle=fixture();battle.sides.B.roster[0].hp=1;let result=resolveMove(battle,action('fell-stinger'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.A.roster[0].stages.atk,3);
 battle=fixture();result=resolveMove(battle,action('fell-stinger'),{nextRandom:()=>.999});assert.ok(result.battle.sides.B.roster[0].hp>0);assert.equal(result.battle.sides.A.roster[0].stages.atk,0);
});

test('Clangorous Soul pays one-third max HP only when at least one post-ability stage can change',()=>{
 let battle=fixture();battle.sides.A.roster[0].hp=1500;let result=resolveMove(battle,action('clangorous-soul',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,900);for(const stat of ['atk','def','spa','spd','spe'])assert.equal(result.battle.sides.A.roster[0].stages[stat],1);
 battle=fixture();battle.sides.A.roster[0].hp=600;const before=battle.sides.A.roster[0].pp['clangorous-soul'];result=resolveMove(battle,action('clangorous-soul',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,600);assert.equal(result.battle.sides.A.roster[0].pp['clangorous-soul'],before-1);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='insufficientHpForCost'));
 battle=fixture();for(const stat of ['atk','def','spa','spd','spe'])battle.sides.A.roster[0].stages[stat]=6;result=resolveMove(battle,action('clangorous-soul',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,1800);assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='noPotentialStageChange'));
 battle=fixture();for(const stat of ['atk','def','spa','spd','spe'])battle.sides.A.roster[0].stages[stat]=6;setAbility(battle,'A',0,'contrary');result=resolveMove(battle,action('clangorous-soul',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,1200);for(const stat of ['atk','def','spa','spd','spe'])assert.equal(result.battle.sides.A.roster[0].stages[stat],5);
});

test('Freeze-Dry overrides only Water effectiveness and preserves dual-type multiplication',()=>{
 let battle=fixture();battle.sides.B.roster[0].types=['water'];let result=resolveMove(battle,action('freeze-dry'),{nextRandom:()=>.999});assert.equal(damageTo(result).effectiveness,2);assert.equal(result.battle.sides.B.roster[0].status,null);
 battle=fixture();battle.sides.B.roster[0].types=['water','ground'];result=resolveMove(battle,action('freeze-dry'),{nextRandom:()=>.999});assert.equal(damageTo(result).effectiveness,4);
 battle=fixture();battle.sides.B.roster[0].types=['fire'];result=resolveMove(battle,action('freeze-dry'),{nextRandom:()=>.999});assert.equal(damageTo(result).effectiveness,.5);
});

test('Acupressure selects only raisable stats, supports self/ally targets, and respects ally Substitute',()=>{
 let battle=fixture();for(const stat of Object.keys(blankStages()))battle.sides.A.roster[0].stages[stat]=6;battle.sides.A.roster[0].stages.spe=0;let result=resolveMove(battle,action('acupressure',{side:'A',slot:0}),{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].stages.spe,2);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.random));
 battle=fixture('double');result=resolveMove(battle,action('acupressure',{side:'A',slot:1}),{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[1].stages.atk,2);
 battle=fixture('double');battle.sides.A.roster[1].volatiles.substitute={id:'substitute',hp:300,maxHp:300};result=resolveMove(battle,action('acupressure',{side:'A',slot:1}),{nextRandom:()=>0});assert.deepEqual(result.battle.sides.A.roster[1].stages,blankStages());assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.reason==='substitute'));
});

test('Heal Pulse heals the selected adjacent target and Mega Launcher raises pulse healing to 75%',()=>{
 let battle=fixture('double');battle.sides.A.roster[1].hp=200;let result=resolveMove(battle,action('heal-pulse',{side:'A',slot:1}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[1].hp,1100);assert.equal(result.battle.sides.A.roster[0].hp,1800);
 battle=fixture('double');battle.sides.A.roster[1].hp=200;setAbility(battle,'A',0,'mega-launcher');result=resolveMove(battle,action('heal-pulse',{side:'A',slot:1}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[1].hp,1550);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='mega-launcher'));
 battle=fixture();battle.sides.B.roster[0].hp=200;result=resolveMove(battle,action('heal-pulse'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].hp,1100,'Heal Pulse can intentionally heal an adjacent foe');
});
