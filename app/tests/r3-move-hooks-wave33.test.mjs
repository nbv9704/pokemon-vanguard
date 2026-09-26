import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHeldItemState,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,resolveEntryHazards} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['gigaton-hammer','last-resort','sucker-punch','upper-hand'];
const byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const registry=createHookRegistry(HANDLER_DEFINITIONS),resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry}),validateAction=createMoveChoiceValidator({moves,manifests:manifests.moves});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,24]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1200,maxHp:1200,stats:{hp:1200,atk:220,def:180,spa:180,spd:180,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null,moveIds:ids},itemState:createHeldItemState(null),...overrides});
function fixture(format='double'){const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`wave33-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:7,activeCount:n,rngState:33,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};}
const action=(moveId,target={side:'B',slot:0},side='A',actorId='a1')=>({kind:'move',side,actorId,moveId,target,moveType:byId[moveId].type,moveCategory:byId[moveId].category,priority:manifests.moves[moveId].priority,speed:100});
const runtimeFor=pending=>({nextRandom:()=>.01,hasActed:()=>false,willMove:id=>Boolean(pending?.[id]),pendingActionFor:id=>pending?.[id]||null});
const evidence={single:['r3-move-hooks-wave33:single'],double:['r3-move-hooks-wave33:double']};

test('r3-move-hooks-wave33:single promotes action-context family with audited priority/contact',()=>{
 for(const id of ids){assert.ok(manifests.moves[id],id);assert.deepEqual(manifests.moves[id].testEvidence,evidence,id);}
 assert.equal(manifests.moves['gigaton-hammer'].contact,false);assert.equal(manifests.moves['sucker-punch'].priority,1);assert.equal(manifests.moves['upper-hand'].priority,3);assert.equal(manifests.moves['upper-hand'].secondaryEffects[0].volatile,'flinch');
});

test('Gigaton Hammer is rejected on consecutive entry-local use and switch-in resets that history',()=>{
 let battle=fixture('single'),result=resolveMove(battle,action('gigaton-hammer'),runtimeFor());assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='gigaton-hammer'));assert.equal(result.battle.sides.A.roster[0].lastUsedMoveIdSinceEntry,'gigaton-hammer');
 const choice=validateAction(result.battle,action('gigaton-hammer'));assert.equal(choice.code,'CONSECUTIVE_MOVE_BLOCKED');
 const blocked=resolveMove(result.battle,action('gigaton-hammer'),runtimeFor());assert.ok(blocked.events.some(e=>e.kind==='actionPrevented'&&e.reason==='CONSECUTIVE_MOVE_BLOCKED'));
 battle=fixture('double');battle.sides.A.roster[2].lastUsedMoveIdSinceEntry='gigaton-hammer';battle.sides.A.roster[2].usedMoveIdsSinceEntry=['gigaton-hammer'];const entered=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'a3',side:'A',slot:0}],{manifests,moves:byId});assert.equal(entered.battle.sides.A.roster[2].lastUsedMoveIdSinceEntry,null);assert.deepEqual(entered.battle.sides.A.roster[2].usedMoveIdsSinceEntry,[]);
});

test('Last Resort consumes PP but fails until every other known move has been used since entry',()=>{
 let battle=fixture('single'),actor=battle.sides.A.roster[0];actor.usedMoveIdsSinceEntry=['gigaton-hammer','sucker-punch'];actor.lastUsedMoveIdSinceEntry='sucker-punch';const before=actor.pp['last-resort'];let result=resolveMove(battle,action('last-resort'),runtimeFor());assert.equal(result.battle.sides.A.roster[0].pp['last-resort'],before-1);assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='otherMovesUnused'&&e.missingMoveIds.includes('upper-hand')));
 battle=fixture('single');actor=battle.sides.A.roster[0];actor.usedMoveIdsSinceEntry=['gigaton-hammer','sucker-punch','upper-hand'];actor.lastUsedMoveIdSinceEntry='upper-hand';result=resolveMove(battle,action('last-resort'),runtimeFor());assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='last-resort'&&e.amount>0));
});

test('Sucker Punch requires a queued damaging move from its target',()=>{
 const damaging={kind:'move',side:'B',actorId:'b1',moveId:'probe-hit',moveCategory:'physical',priority:0,speed:80};let result=resolveMove(fixture('single'),action('sucker-punch'),runtimeFor({b1:damaging}));assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='sucker-punch'));
 const status={...damaging,moveId:'probe-status',moveCategory:'status'};result=resolveMove(fixture('single'),action('sucker-punch'),runtimeFor({b1:status}));assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='targetNotAttacking'));assert.equal(result.battle.sides.B.roster[0].hp,1200);
});

test('r3-move-hooks-wave33:double Upper Hand only intercepts positive-priority attacks and applies flinch',()=>{
 const priorityAttack={kind:'move',side:'B',actorId:'b1',moveId:'quick-attack',moveCategory:'physical',priority:1,speed:80};let result=resolveMove(fixture(),action('upper-hand'),runtimeFor({b1:priorityAttack}));assert.ok(result.events.some(e=>e.kind==='damage'&&e.moveId==='upper-hand'));assert.equal(result.battle.sides.B.roster[0].volatiles.flinch?.id,'flinch');
 const ordinary={...priorityAttack,priority:0};result=resolveMove(fixture(),action('upper-hand'),runtimeFor({b1:ordinary}));assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='targetNotUsingPriorityAttack'));assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);
});
