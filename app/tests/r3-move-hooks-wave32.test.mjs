import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,lastDamageReceivedThisTurn,recordTurnEvents} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['counter','mirror-coat','metal-burst','comeuppance','focus-punch'];
const byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const registry=createHookRegistry(HANDLER_DEFINITIONS),resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,24]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:4000,maxHp:4000,stats:{hp:4000,atk:220,def:180,spa:220,spd:180,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null,moveIds:ids},itemState:createHeldItemState(null),...overrides});
function fixture(format='double'){const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`wave32-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:4,activeCount:n,rngState:32,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const runtime={nextRandom:()=>.5,hasActed:()=>false,willMove:()=>false};
const evidence={single:['r3-move-hooks-wave32:single'],double:['r3-move-hooks-wave32:double']};
const hit=(sourceId,targetId,amount,category,sourceSlot,moveId=`probe-${category}`)=>({kind:'damage',actorId:sourceId,targetId,moveId,category,sourceSide:'B',sourceSlot,hpBefore:4000,hpAfter:4000-amount,amount,effectiveness:1,breakdown:{}});

test('r3-move-hooks-wave32:single promotes four retaliation moves plus Focus Punch with audited priority',()=>{
 for(const id of ids){assert.ok(manifests.moves[id],id);assert.deepEqual(manifests.moves[id].testEvidence,evidence,id);}
 assert.equal(manifests.moves.counter.priority,-5);assert.equal(manifests.moves['mirror-coat'].priority,-5);assert.equal(manifests.moves['metal-burst'].priority,0);assert.equal(manifests.moves['focus-punch'].priority,-3);assert.equal(manifests.moves['focus-punch'].tags.includes('punch'),true);
});

test('turn history preserves last overall and last category-specific damaging hits',()=>{
 let battle=fixture();battle=recordTurnEvents(battle,[hit('b1','a1',90,'physical',0,'physical-hit'),hit('b2','a1',70,'special',1,'special-hit')],{turn:4});
 assert.equal(lastDamageReceivedThisTurn(battle,'a1').sourceId,'b2');assert.equal(lastDamageReceivedThisTurn(battle,'a1','physical').sourceId,'b1');assert.equal(lastDamageReceivedThisTurn(battle,'a1','special').sourceId,'b2');
});

test('Counter and Mirror Coat use their category-specific last hit and auto-target its slot in doubles',()=>{
 let battle=fixture();battle=recordTurnEvents(battle,[hit('b1','a1',90,'physical',0),hit('b2','a1',70,'special',1)],{turn:4});
 let result=resolveMove(battle,action('counter',{side:'B',slot:1}),runtime);assert.equal(result.battle.sides.B.roster[0].hp,4000-180);assert.equal(result.battle.sides.B.roster[1].hp,4000);assert.ok(result.events.some(e=>e.kind==='retaliationPrepared'&&e.targetId==='b1'&&e.preparedFixedDamage===180));
 battle=fixture();battle=recordTurnEvents(battle,[hit('b1','a1',90,'physical',0),hit('b2','a1',70,'special',1)],{turn:4});result=resolveMove(battle,action('mirror-coat',{side:'B',slot:0}),runtime);assert.equal(result.battle.sides.B.roster[1].hp,4000-140);assert.equal(result.battle.sides.B.roster[0].hp,4000);
});

test('Metal Burst and Comeuppance retaliate for floor(1.5x) of the latest damaging hit',()=>{
 for(const id of ['metal-burst','comeuppance']){let battle=fixture();battle=recordTurnEvents(battle,[hit('b2','a1',151,'special',1)],{turn:4});const result=resolveMove(battle,action(id),runtime),damage=result.events.find(e=>e.kind==='damage'&&e.moveId===id);assert.equal(damage.amount,226,id);assert.equal(damage.targetId,'b2',id);}
});

test('retaliation keeps the attacker slot so a pivot replacement becomes the scripted target',()=>{
 let battle=fixture();battle=recordTurnEvents(battle,[hit('b1','a1',80,'physical',0)],{turn:4});battle.sides.B.active[0]='b3';
 const result=resolveMove(battle,action('counter',{side:'B',slot:1}),runtime);assert.equal(result.battle.sides.B.roster[2].hp,4000-160);assert.equal(result.battle.sides.B.roster[0].hp,4000);assert.ok(result.events.some(e=>e.kind==='retaliationPrepared'&&e.targetId==='b3'));
});

test('retaliation fails closed without a qualifying hit, while Focus Punch fails only after damaging move damage',()=>{
 let battle=fixture('single'),result=resolveMove(battle,action('counter'),runtime);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='noRetaliationDamage'));assert.equal(result.battle.sides.B.roster[0].hp,4000);assert.equal(result.battle.sides.A.roster[0].lastMoveOutcome.result,false);
 battle=fixture('single');result=resolveMove(battle,action('focus-punch'),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='focus-punch'&&e.amount>0));
 battle=fixture('single');battle=recordTurnEvents(battle,[hit('b1','a1',1,'special',0,'quick-hit')],{turn:4});const beforePp=battle.sides.A.roster[0].pp['focus-punch'];result=resolveMove(battle,action('focus-punch'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,4000);assert.equal(result.battle.sides.A.roster[0].pp['focus-punch'],beforePp-1);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='lostFocus'));assert.equal(result.battle.sides.A.roster[0].lastMoveOutcome.result,false);
});
