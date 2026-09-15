import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';
import {applySwitch} from '../rules-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['stone-axe','ceaseless-edge','foul-play','psych-up','speed-swap','guard-split','power-split','power-trick'];
const ids=[...promoted],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:2400,maxHp:2400,stats:{hp:2400,atk:220,def:160,spa:180,spd:140,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`wave25-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:25,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const evidence={single:['r3-move-hooks-wave25:single'],double:['r3-move-hooks-wave25:double']};
const setAbility=(battle,side,index,id)=>{const actor=battle.sides[side].roster[index];actor.buildSnapshot.abilityId=id;actor.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const damageTo=(result,id='b1')=>result.events.find(event=>event.kind==='damage'&&event.targetId===id&&event.moveId);

test('r3-move-hooks-wave25:single all 8 declarations use shared Wave 25 mechanics',()=>{
 assert.equal(promoted.length,8);for(const id of promoted){const manifest=manifests.moves[id];assert.ok(manifest,`${id}: manifest`);assert.deepEqual(manifest.testEvidence,evidence,`${id}: evidence`);assert.equal(manifest.handlers[0].id,'spend-pp');}
 assert.equal(manifests.moves['stone-axe'].handlers.at(-1).params.hazard,'stealth-rock');assert.equal(manifests.moves['ceaseless-edge'].handlers.at(-1).params.hazard,'spikes');
 assert.equal(manifests.moves['foul-play'].damageProfile.offensiveSource,'target');assert.equal(manifests.moves['psych-up'].bypassSubstitute,true);assert.equal(manifests.moves['speed-swap'].bypassSubstitute,true);
});

test('Stone Axe and Ceaseless Edge apply hazards only after damage, including Substitute damage',()=>{
 let battle=fixture();let result=resolveMove(battle,action('stone-axe'),{nextRandom:()=>.5});assert.equal(result.battle.sides.B.conditions['stealth-rock'].layers,1);assert.ok(damageTo(result)?.amount>0);
 battle=fixture();battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};result=resolveMove(battle,action('ceaseless-edge'),{nextRandom:()=>.5});assert.equal(result.battle.sides.B.conditions.spikes.layers,1);assert.ok(result.events.some(event=>event.kind==='substituteDamaged'));
 battle=fixture();result=resolveMove(battle,action('stone-axe'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.conditions['stealth-rock'],undefined,'accuracy miss cannot lay the hazard');
});

test('Sheer Force boosts Stone Axe/Ceaseless Edge and suppresses their post-hit hazards',()=>{
 let plain=fixture();let normal=resolveMove(plain,action('stone-axe'),{nextRandom:()=>.5});const normalDamage=damageTo(normal).amount;
 let force=fixture();setAbility(force,'A',0,'sheer-force');let boosted=resolveMove(force,action('stone-axe'),{nextRandom:()=>.5});assert.ok(damageTo(boosted).amount>normalDamage);assert.equal(boosted.battle.sides.B.conditions['stealth-rock'],undefined);assert.ok(boosted.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='sheer-force'));
 force=fixture();setAbility(force,'A',0,'sheer-force');boosted=resolveMove(force,action('ceaseless-edge'),{nextRandom:()=>.5});assert.equal(boosted.battle.sides.B.conditions.spikes,undefined);
});

test('Foul Play uses the target Attack stat and Attack stages rather than the user stored Attack',()=>{
 let high=fixture();high.sides.B.roster[0].stats.atk=420;high.sides.B.roster[0].stages.atk=2;high.sides.A.roster[0].stats.atk=40;high.sides.A.roster[0].stages.atk=-6;const highResult=resolveMove(high,action('foul-play'),{nextRandom:()=>.999});
 let low=fixture();low.sides.B.roster[0].stats.atk=100;low.sides.B.roster[0].stages.atk=0;low.sides.A.roster[0].stats.atk=900;low.sides.A.roster[0].stages.atk=6;const lowResult=resolveMove(low,action('foul-play'),{nextRandom:()=>.999});
 assert.ok(damageTo(highResult).amount>damageTo(lowResult).amount*3);assert.equal(damageTo(highResult).breakdown.damageProfile.offensiveSource,'target');
});

test('Psych Up copies all battle stages and supported critical-stage state through Substitute',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.stages.atk=-4;actor.volatiles['focus-energy']={id:'focus-energy',criticalRatioStages:2};target.stages={atk:3,def:-2,spa:1,spd:2,spe:-1,accuracy:2,evasion:-3};target.volatiles.substitute={id:'substitute',hp:500,maxHp:500};target.volatiles['focus-energy']={id:'focus-energy',criticalRatioStages:2};
 const result=resolveMove(battle,action('psych-up'),{nextRandom:()=>.999}),after=result.battle.sides.A.roster[0];assert.deepEqual(after.stages,target.stages);assert.equal(after.volatiles['focus-energy'].criticalRatioStages,2);assert.ok(result.events.some(event=>event.kind==='statStagesCopied'));
 const noFocus=fixture();noFocus.sides.A.roster[0].volatiles['focus-energy']={id:'focus-energy',criticalRatioStages:2};const cleared=resolveMove(noFocus,action('psych-up'),{nextRandom:()=>.999});assert.equal(cleared.battle.sides.A.roster[0].volatiles['focus-energy'],undefined);
});

test('Speed Swap exchanges stored Speed through Substitute and switch-out restores original stored stats',()=>{
 const battle=fixture();battle.sides.A.roster[0].stats.spe=70;battle.sides.B.roster[0].stats.spe=210;battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};const result=resolveMove(battle,action('speed-swap'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.spe,210);assert.equal(result.battle.sides.B.roster[0].stats.spe,70);
 const switched=applySwitch(result.battle,'A','a1','a3');assert.equal(switched.ok,true);assert.equal(switched.battle.sides.A.roster[0].stats.spe,70);assert.deepEqual(switched.battle.sides.A.roster[0].volatiles,{});
});

test('Guard Split and Power Split floor pairwise stored-stat averages and respect Substitute',()=>{
 let battle=fixture();battle.sides.A.roster[0].stats.def=101;battle.sides.A.roster[0].stats.spd=81;battle.sides.B.roster[0].stats.def=200;battle.sides.B.roster[0].stats.spd=140;let result=resolveMove(battle,action('guard-split'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.def,150);assert.equal(result.battle.sides.B.roster[0].stats.def,150);assert.equal(result.battle.sides.A.roster[0].stats.spd,110);
 battle=fixture();battle.sides.A.roster[0].stats.atk=101;battle.sides.A.roster[0].stats.spa=81;battle.sides.B.roster[0].stats.atk=200;battle.sides.B.roster[0].stats.spa=140;result=resolveMove(battle,action('power-split'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.atk,150);assert.equal(result.battle.sides.B.roster[0].stats.spa,110);
 battle=fixture();battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};const before=structuredClone(battle.sides.A.roster[0].stats);result=resolveMove(battle,action('guard-split'),{nextRandom:()=>.999});assert.deepEqual(result.battle.sides.A.roster[0].stats,before);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.reason==='substitute'));
});

test('Power Trick toggles current Attack/Defense and switch-out restores the pre-transform stored stats',()=>{
 let battle=fixture();battle.sides.A.roster[0].stats.atk=310;battle.sides.A.roster[0].stats.def=90;let result=resolveMove(battle,action('power-trick',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.atk,90);assert.equal(result.battle.sides.A.roster[0].stats.def,310);assert.ok(result.battle.sides.A.roster[0].volatiles['power-trick']);
 result=resolveMove(result.battle,action('power-trick',{side:'A',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.atk,310);assert.equal(result.battle.sides.A.roster[0].stats.def,90);assert.equal(result.battle.sides.A.roster[0].volatiles['power-trick'],undefined);
 battle=fixture();battle.sides.A.roster[0].stats.atk=310;battle.sides.A.roster[0].stats.def=90;result=resolveMove(battle,action('power-trick',{side:'A',slot:0}),{nextRandom:()=>.999});const switched=applySwitch(result.battle,'A','a1','a3');assert.equal(switched.battle.sides.A.roster[0].stats.atk,310);assert.equal(switched.battle.sides.A.roster[0].stats.def,90);
});

test('r3-move-hooks-wave25:double stored-stat transforms affect only the selected adjacent target',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].stats.spe=60;battle.sides.A.roster[1].stats.spe=90;battle.sides.B.roster[0].stats.spe=120;battle.sides.B.roster[1].stats.spe=240;const result=resolveMove(battle,action('speed-swap',{side:'B',slot:1}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].stats.spe,240);assert.equal(result.battle.sides.B.roster[1].stats.spe,60);assert.equal(result.battle.sides.B.roster[0].stats.spe,120);assert.equal(result.battle.sides.A.roster[1].stats.spe,90);
});
