import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const byId=Object.fromEntries(catalog.map(move=>[move.id,move]));

const highCrit={
 'air-cutter':{targetMode:'allAdjacentFoes',tags:['slicing']},
 'aqua-cutter':{tags:['slicing']},
 crabhammer:{contact:true},
 'cross-chop':{contact:true},
 'drill-run':{contact:true},
 'leaf-blade':{contact:true,tags:['slicing']},
 'night-slash':{contact:true,tags:['slicing']},
 'psycho-cut':{tags:['slicing']},
 'shadow-claw':{contact:true,tags:['slicing']},
 'stone-edge':{},
 'blaze-kick':{contact:true,secondary:{kind:'major-status',chance:10,status:'burn'}},
 'cross-poison':{contact:true,tags:['slicing'],secondary:{kind:'major-status',chance:10,status:'poison'}},
};
const alwaysCrit={
 'flower-trick':{},
 'frost-breath':{},
 'storm-throw':{contact:true},
};
const drain={
 'bitter-blade':{contact:true,tags:['slicing'],fraction:[1,2]},
 'leech-life':{contact:true,fraction:[1,2]},
 'parabolic-charge':{targetMode:'allAdjacent',fraction:[1,2]},
};
const recoil={
 'wood-hammer':{contact:true,fraction:[33,100]},
 'light-of-ruin':{fraction:[1,2]},
 'volt-tackle':{contact:true,fraction:[33,100],secondary:{kind:'major-status',chance:10,status:'paralysis'}},
};
const direct={surf:{targetMode:'allAdjacent'},swift:{targetMode:'allAdjacentFoes'}};
const ids=[...Object.keys(highCrit),...Object.keys(alwaysCrit),...Object.keys(drain),...Object.keys(recoil),...Object.keys(direct)];
const moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1200,maxHp:1200,stats:{hp:1200,atk:160,def:130,spa:160,spd:130,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']})];
 return {id:`wave20-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:20,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const always=()=>0;
const setAbility=(battle,side,index,id)=>{const unit=battle.sides[side].roster[index];unit.buildSnapshot.abilityId=id;unit.passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const setItem=(battle,side,index,id)=>{const unit=battle.sides[side].roster[index];unit.buildSnapshot.itemId=id;unit.itemState=createHeldItemState(id);unit.passiveEffects=[...unit.passiveEffects,...compilePassiveEffects({itemId:id,manifests})];};
const damageEvent=result=>result.events.find(event=>event.kind==='damage'&&event.targetId==='b1');
function expectBase(id,spec={}){
 const m=manifests.moves[id];assert.ok(m,`${id}: manifest`);assert.equal(m.targetMode,spec.targetMode??'adjacentFoe',`${id}: target`);assert.equal(m.priority,0,`${id}: priority`);assert.equal(m.contact,spec.contact??false,`${id}: contact`);assert.deepEqual(m.tags??[],spec.tags??[],`${id}: tags`);assert.deepEqual(m.testEvidence,{single:['r3-move-hooks-wave20:single'],double:['r3-move-hooks-wave20:double']},`${id}: evidence`);
}
function expectSecondary(id,secondary){
 assert.deepEqual(manifests.moves[id].secondaryEffects,secondary?[secondary]:undefined,`${id}: secondary`);
}
function expectLinkedHandler(id,kind,fraction){
 const handler=manifests.moves[id].handlers.find(entry=>entry.id===kind);assert.deepEqual(handler?.params,{numerator:fraction[0],denominator:fraction[1]},`${id}: ${kind}`);
}

test('r3-move-hooks-wave20:single all 23 promoted declarations match the audited crit, drain, recoil, and direct-damage families',()=>{
 assert.equal(ids.length,23);assert.equal(new Set(ids).size,23);
 for(const [id,spec] of Object.entries(highCrit)){expectBase(id,spec);assert.equal(manifests.moves[id].criticalRatioStages,1,id);assert.equal(manifests.moves[id].alwaysCritical,undefined,id);expectSecondary(id,spec.secondary);}
 for(const [id,spec] of Object.entries(alwaysCrit)){expectBase(id,spec);assert.equal(manifests.moves[id].alwaysCritical,true,id);assert.equal(manifests.moves[id].criticalRatioStages,undefined,id);}
 for(const [id,spec] of Object.entries(drain)){expectBase(id,spec);expectLinkedHandler(id,'apply-drain',spec.fraction);}
 for(const [id,spec] of Object.entries(recoil)){expectBase(id,spec);expectLinkedHandler(id,'apply-recoil',spec.fraction);expectSecondary(id,spec.secondary);}
 for(const [id,spec] of Object.entries(direct))expectBase(id,spec);
});

test('every Wave 20 move executes its promoted runtime family at least once',()=>{
 for(const id of Object.keys(highCrit)){const result=resolveMove(fixture(id==='air-cutter'?'double':'single'),action(id),{nextRandom:always});assert.ok(result.events.some(event=>event.kind==='damage'&&event.amount>0),`${id}: damage`);assert.equal(damageEvent(result)?.breakdown.critical,1.5,`${id}: high crit can trigger`);}
 for(const id of Object.keys(alwaysCrit)){const result=resolveMove(fixture(),action(id),{nextRandom:always});assert.ok(damageEvent(result)?.amount>0,`${id}: damage`);assert.equal(damageEvent(result)?.breakdown.critical,1.5,`${id}: always critical`);}
 for(const id of Object.keys(drain)){const battle=fixture(id==='parabolic-charge'?'double':'single');battle.sides.A.roster[0].hp=400;const result=resolveMove(battle,action(id),{nextRandom:()=>.999});assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='drain'),`${id}: drain`);}
 for(const id of Object.keys(recoil)){const result=resolveMove(fixture(),action(id),{nextRandom:always});assert.ok(result.events.some(event=>event.kind==='damage'&&event.targetId==='a1'&&event.source==='recoil'),`${id}: recoil`);if(recoil[id].secondary)assert.ok(result.events.some(event=>event.kind==='statusApplied'),`${id}: secondary`);}
 for(const id of Object.keys(direct)){const result=resolveMove(fixture('double'),action(id),{nextRandom:()=>.999});assert.ok(result.events.some(event=>event.kind==='damage'&&event.amount>0),`${id}: damage`);}
});

test('high-critical-ratio metadata composes with Scope Lens and Sharpness without move-specific branches',()=>{
 let battle=fixture(),result=resolveMove(battle,action('aqua-cutter'),{nextRandom:(()=>{const rolls=[.4,.999];return()=>rolls.shift()??.999;})()});assert.equal(damageEvent(result).breakdown.critical,1,'high crit alone does not pass a 0.4 roll');
 battle=fixture();setItem(battle,'A',0,'scope-lens');result=resolveMove(battle,action('aqua-cutter'),{nextRandom:(()=>{const rolls=[.4,.999];return()=>rolls.shift()??.999;})()});assert.equal(damageEvent(result).breakdown.critical,1.5,'move + Scope Lens reaches the 1/2 critical stage');
 const plain=resolveMove(fixture(),action('aqua-cutter'),{nextRandom:()=>.999});battle=fixture();setAbility(battle,'A',0,'sharpness');const sharp=resolveMove(battle,action('aqua-cutter'),{nextRandom:()=>.999});assert.ok(damageEvent(sharp).amount>damageEvent(plain).amount,'slicing tag composes with Sharpness');
});

test('always-critical moves remain subject to critical-immunity abilities',()=>{
 let result=resolveMove(fixture(),action('flower-trick'),{nextRandom:()=>.999});assert.equal(damageEvent(result).breakdown.critical,1.5);
 const battle=fixture();setAbility(battle,'B',0,'shell-armor');result=resolveMove(battle,action('flower-trick'),{nextRandom:()=>.999});assert.equal(damageEvent(result).breakdown.critical,1);assert.ok(damageEvent(result).amount>0);
});

test('r3-move-hooks-wave20:double spread targeting and linked drain use aggregate actual damage',()=>{
 let battle=fixture('double');battle.sides.A.roster[0].hp=100;let result=resolveMove(battle,action('parabolic-charge'),{nextRandom:()=>.999});let damages=result.events.filter(event=>event.kind==='damage'&&event.moveId==='parabolic-charge'),heal=result.events.find(event=>event.kind==='heal'&&event.source==='drain');assert.equal(damages.length,3);assert.deepEqual(new Set(damages.map(event=>event.targetId)),new Set(['a2','b1','b2']));assert.equal(heal.amount,Math.min(1100,Math.max(1,Math.round(damages.reduce((sum,event)=>sum+event.amount,0)/2))));
 result=resolveMove(fixture('double'),action('surf'),{nextRandom:()=>.999});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['a2','b1','b2']));
 battle=fixture('double');battle.sides.A.roster[0].stages.accuracy=-6;battle.sides.B.roster[0].stages.evasion=6;battle.sides.B.roster[1].stages.evasion=6;result=resolveMove(battle,action('swift'),{nextRandom:()=>.999});assert.deepEqual(new Set(result.events.filter(event=>event.kind==='damage').map(event=>event.targetId)),new Set(['b1','b2']));assert.equal(result.events.some(event=>event.kind==='moveMissed'),false);
});
