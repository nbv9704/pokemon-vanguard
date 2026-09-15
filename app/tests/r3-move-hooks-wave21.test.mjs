import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const byId=Object.fromEntries(catalog.map(move=>[move.id,move]));
const ids=['slash','ice-shard','dynamic-punch','double-hit','twin-beam','rock-wrecker','icy-wind','triple-arrows','spicy-extract','toxic-thread','sweet-kiss','teeter-dance','bounce','blizzard','infernal-parade','recover','slack-off','life-dew','moonlight','morning-sun','synthesis','haze','clear-smog','brick-break','psychic-fangs','explosion','self-destruct'];
const moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1200,maxHp:1200,stats:{hp:1200,atk:160,def:130,spa:160,spd:130,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']})];
 return {id:`wave21-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:21,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const setAbility=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.abilityId=id;actor.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const damageTo=(result,id='b1')=>result.events.find(event=>event.kind==='damage'&&event.targetId===id&&event.source!=='self-sacrifice');
const evidence={single:['r3-move-hooks-wave21:single'],double:['r3-move-hooks-wave21:double']};

test('r3-move-hooks-wave21:single all 27 declarations are promoted with Wave 21 evidence and generic handlers',()=>{
 assert.equal(ids.length,27);assert.equal(new Set(ids).size,27);
 for(const id of ids){const manifest=manifests.moves[id];assert.ok(manifest,`${id}: manifest`);assert.deepEqual(manifest.testEvidence,evidence,`${id}: evidence`);assert.ok(manifest.handlers.some(entry=>entry.id==='spend-pp'),`${id}: spends PP`);}
 assert.equal(manifests.moves['ice-shard'].priority,1);assert.equal(manifests.moves.slash.criticalRatioStages,1);assert.deepEqual(manifests.moves.slash.tags,['slicing']);
 assert.equal(manifests.moves['dynamic-punch'].contact,true);assert.deepEqual(manifests.moves['dynamic-punch'].tags,['punch']);assert.equal(manifests.moves['rock-wrecker'].handlers.at(-1).id,'apply-recharge');assert.deepEqual(manifests.moves['rock-wrecker'].tags,['bullet']);
 assert.equal(manifests.moves['icy-wind'].targetMode,'allAdjacentFoes');assert.equal(manifests.moves['teeter-dance'].targetMode,'allAdjacent');assert.equal(manifests.moves.blizzard.targetMode,'allAdjacentFoes');
 assert.deepEqual(manifests.moves['toxic-thread'].handlers.find(entry=>entry.id==='apply-stat-stages').params.boosts,{spe:-2},'Champions candidate override keeps -2 Speed');
 assert.deepEqual(manifests.moves.blizzard.handlers.find(entry=>entry.id==='check-accuracy').params,{alwaysHitsInWeather:['snow']});
 assert.equal(manifests.moves['psychic-fangs'].contact,true);assert.deepEqual(manifests.moves['psychic-fangs'].tags,['bite']);assert.equal(manifests.moves.explosion.redirectable,false);
});

test('existing damage primitives cover crit, priority, fixed multi-hit, recharge, stage/status secondaries, and status-scaled power',()=>{
 let result=resolveMove(fixture(),action('slash'),{nextRandom:()=>0});assert.ok(damageTo(result)?.amount>0);assert.equal(damageTo(result).breakdown.critical,1.5);
 result=resolveMove(fixture(),action('ice-shard'),{nextRandom:()=>.999});assert.ok(damageTo(result)?.amount>0);
 result=resolveMove(fixture(),action('dynamic-punch'),{nextRandom:()=>0});assert.ok(result.events.some(event=>event.kind==='volatileApplied'&&event.volatile==='confusion'));
 for(const id of ['double-hit','twin-beam']){result=resolveMove(fixture(),action(id),{nextRandom:()=>0});assert.equal(result.events.find(event=>event.kind==='hitCount')?.hitCount,2,`${id}: exactly two hits`);}
 result=resolveMove(fixture(),action('rock-wrecker'),{nextRandom:()=>0});assert.ok(result.events.some(event=>event.kind==='rechargeRequired'));assert.ok(result.battle.sides.A.roster[0].volatiles['must-recharge']);
 result=resolveMove(fixture('double'),action('icy-wind'),{nextRandom:()=>0});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='statStageChanged'&&event.stat==='spe').map(event=>event.targetId)),new Set(['b1','b2']));
 result=resolveMove(fixture(),action('triple-arrows'),{nextRandom:()=>0});assert.equal(damageTo(result).breakdown.critical,1.5);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.stat==='def'));assert.ok(result.events.some(event=>event.kind==='volatileApplied'&&event.volatile==='flinch'));
 const plain=resolveMove(fixture(),action('infernal-parade'),{nextRandom:()=>.999}),statusBattle=fixture();statusBattle.sides.B.roster[0].status={id:'poison',sourceId:'fixture',turnsActive:0};const doubled=resolveMove(statusBattle,action('infernal-parade'),{nextRandom:()=>.999});assert.equal(doubled.events.find(event=>event.kind==='powerResolved')?.power,130);assert.equal(plain.events.find(event=>event.kind==='powerResolved')?.power,65);assert.ok(damageTo(doubled).amount>damageTo(plain).amount);
});

test('primary status/stat moves cover null accuracy, reflection-ready targeting, Champions Toxic Thread, and all-adjacent confusion',()=>{
 let result=resolveMove(fixture(),action('spicy-extract'),{nextRandom:()=>.999});let target=result.battle.sides.B.roster[0];assert.equal(target.stages.atk,2);assert.equal(target.stages.def,-2);assert.equal(result.events.some(event=>event.kind==='moveMissed'),false);
 result=resolveMove(fixture(),action('toxic-thread'),{nextRandom:()=>.999});target=result.battle.sides.B.roster[0];assert.equal(target.status?.id,'poison');assert.equal(target.stages.spe,-2);
 result=resolveMove(fixture(),action('sweet-kiss'),{nextRandom:()=>0});assert.ok(result.battle.sides.B.roster[0].volatiles.confusion);
 result=resolveMove(fixture('double'),action('teeter-dance'),{nextRandom:()=>0});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='volatileApplied'&&event.volatile==='confusion').map(event=>event.targetId)),new Set(['a2','b1','b2']));
});

test('r3-move-hooks-wave21:double two-turn Bounce and snow-perfect Blizzard execute through shared timing and accuracy primitives',()=>{
 let battle=fixture(),prepared=resolveMove(battle,action('bounce'),{nextRandom:()=>.999});assert.ok(prepared.events.some(event=>event.kind==='twoTurnMovePrepared'&&event.semiInvulnerable==='airborne'));assert.equal(prepared.events.some(event=>event.kind==='damage'),false);
 const released=resolveMove(prepared.battle,action('bounce'),{nextRandom:()=>0});assert.ok(released.events.some(event=>event.kind==='twoTurnMoveReleased'));assert.ok(damageTo(released)?.amount>0);assert.ok(released.events.some(event=>event.kind==='statusApplied'&&event.status==='paralysis'));
 battle=fixture('double');battle.field.weather={id:'snow',remaining:5};battle.sides.A.roster[0].stages.accuracy=-6;for(const target of battle.sides.B.roster)target.stages.evasion=6;let result=resolveMove(battle,action('blizzard'),{nextRandom:()=>.999});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['b1','b2']));assert.equal(result.events.some(event=>event.kind==='moveMissed'),false);
 battle=fixture('double');battle.sides.A.roster[0].stages.accuracy=-6;for(const target of battle.sides.B.roster)target.stages.evasion=6;result=resolveMove(battle,action('blizzard'),{nextRandom:()=>.999});assert.equal(result.events.filter(event=>event.kind==='moveMissed').length,2);
});

test('generic healing primitive covers half heal, doubles Life Dew, weather scaling, and no-healing failure',()=>{
 for(const id of ['recover','slack-off']){const battle=fixture();battle.sides.A.roster[0].hp=300;const result=resolveMove(battle,action(id,{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.events.find(event=>event.kind==='heal')?.amount,600,`${id}: half max HP`);}
 let battle=fixture('double');battle.sides.A.roster[0].hp=400;battle.sides.A.roster[1].hp=800;let result=resolveMove(battle,action('life-dew',{side:'A',slot:0}),{nextRandom:()=>.999});assert.deepEqual(Object.fromEntries(result.events.filter(event=>event.kind==='heal').map(event=>[event.targetId,event.amount])),{a1:300,a2:300});
 for(const id of ['moonlight','morning-sun','synthesis']){battle=fixture();battle.sides.A.roster[0].hp=100;battle.field.weather={id:'sun',remaining:5};result=resolveMove(battle,action(id,{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.events.find(event=>event.kind==='heal')?.amount,800,`${id}: sun 2/3`);battle=fixture();battle.sides.A.roster[0].hp=100;battle.field.weather={id:'rain',remaining:5};result=resolveMove(battle,action(id,{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.events.find(event=>event.kind==='heal')?.amount,300,`${id}: adverse weather 1/4`);}
 result=resolveMove(fixture(),action('recover',{side:'A',slot:0}),{nextRandom:()=>.999});assert.ok(result.events.some(event=>event.kind==='moveFailed'&&event.reason==='noHealing'));
});

test('stage reset and screen breaking are generic, scoped, and occur before damage',()=>{
 let battle=fixture('double');battle.sides.A.roster[0].stages.atk=4;battle.sides.A.roster[1].stages.spe=-3;battle.sides.B.roster[0].stages.def=5;battle.sides.B.roster[1].stages.spa=-2;let result=resolveMove(battle,action('haze',{side:'A',slot:0}),{nextRandom:()=>.999});for(const side of ['A','B'])for(const actor of result.battle.sides[side].roster.slice(0,2))for(const value of Object.values(actor.stages))assert.equal(value,0);assert.equal(result.events.filter(event=>event.kind==='statStagesReset').length,4);
 battle=fixture();battle.sides.A.roster[0].stages.atk=3;battle.sides.B.roster[0].stages.def=4;result=resolveMove(battle,action('clear-smog'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].stages.def,0);assert.equal(result.battle.sides.A.roster[0].stages.atk,3);assert.ok(result.events.some(event=>event.kind==='statStagesReset'&&event.targetId==='b1'));
 for(const id of ['brick-break','psychic-fangs']){battle=fixture();battle.sides.B.conditions.reflect={remaining:5};battle.sides.B.conditions['light-screen']={remaining:5};result=resolveMove(battle,action(id),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.conditions.reflect,undefined);assert.equal(result.battle.sides.B.conditions['light-screen'],undefined);const brokenIndex=result.events.findIndex(event=>event.kind==='sideConditionEnded'&&event.reason==='brokenByMove'),damageIndex=result.events.findIndex(event=>event.kind==='damage'&&event.targetId==='b1');assert.ok(brokenIndex>=0&&damageIndex>brokenIndex,`${id}: screens break before damage`);}
});

test('self-sacrifice moves hit all adjacent units, always faint the user after execution, and still respect Damp global blocking',()=>{
 for(const id of ['explosion','self-destruct']){let battle=fixture('double'),result=resolveMove(battle,action(id),{nextRandom:()=>.999});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage'&&event.source!=='self-sacrifice').map(event=>event.targetId)),new Set(['a2','b1','b2']),`${id}: spread targets`);assert.equal(result.battle.sides.A.roster[0].hp,0);assert.ok(result.events.some(event=>event.kind==='fainted'&&event.targetId==='a1'&&event.source==='self-sacrifice'));battle=fixture('double');setAbility(battle,'B',0,'damp');result=resolveMove(battle,action(id),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].hp,1200,`${id}: Damp prevents sacrifice`);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.reason==='globalAbility'&&event.abilityId==='damp'),`${id}: Damp blocks move`);}
});
