import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';
import {resolveActionQueue,validateTurnActions} from '../rules-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['u-turn','volt-switch','flip-turn','circle-throw','dragon-tail','roar','whirlwind','ally-switch','tackle'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const count=format==='single'?1:2,a=['a1','a2','a3','a4'].map(unit),b=['b1','b2','b3','b4'].map(unit);return {id:`switching-${format}`,rulesVersion:'r3',catalogVersion:'fixture',format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:17,eventSequence:0,events:[],result:null,activeCount:count,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(side,actorId,moveId,target,extra={})=>({kind:'move',side,actorId,moveId,target,...extra});
const runtime=(...rolls)=>{let index=0;return {nextRandom:()=>rolls[index++]??.99};};

test('r3-pivot-switch:single damage pivots each reviewed move into the chosen reserve',()=>{
 for(const moveId of ['u-turn','volt-switch','flip-turn']){const battle=fixture();battle.sides.A.roster[0].stages.atk=2;const result=resolveMove(battle,action('A','a1',moveId,{side:'B',slot:0},{switchToId:'a2'}),runtime());
  assert.equal(result.battle.sides.A.active[0],'a2');assert.equal(result.battle.sides.A.roster[0].stages.atk,0);assert.deepEqual(result.events.filter(event=>['damage','switchOut','switchIn'].includes(event.kind)).map(event=>event.kind),['damage','switchOut','switchIn']);
 }
});

test('pivot does not switch after immunity and reports an invalid chosen reserve after damage',()=>{
 const immune=fixture();immune.sides.B.roster[0].types=['ground'];let result=resolveMove(immune,action('A','a1','volt-switch',{side:'B',slot:0},{switchToId:'a2'}),runtime());assert.equal(result.battle.sides.A.active[0],'a1');assert.equal(result.events.at(-1).reason,'noDamage');
 result=resolveMove(fixture(),action('A','a1','u-turn',{side:'B',slot:0},{switchToId:'missing'}),runtime());assert.equal(result.battle.sides.A.active[0],'a1');assert.equal(result.events.at(-1).reason,'invalidSwitchTarget');
});

test('pivot reserve choice is validated before the command queue locks',()=>{
 const validate=createMoveChoiceValidator({moves,manifests}),battle=fixture(),base=action('A','a1','u-turn',{side:'B',slot:0});
 assert.equal(validate(battle,base).code,'PIVOT_SWITCH_TARGET_REQUIRED');assert.equal(validate(battle,{...base,switchToId:'a1'}).code,'INVALID_PIVOT_SWITCH_TARGET');assert.deepEqual(validate(battle,{...base,switchToId:'a2'}),{ok:true});
 assert.equal(validate(battle,action('A','a1','tackle',{side:'B',slot:0},{switchToId:'a2'})).code,'UNEXPECTED_SWITCH_TARGET');
 const double=fixture('double'),commands=[action('A','a1','u-turn',{side:'B',slot:0},{switchToId:'a3',priority:0,speed:100}),action('A','a2','flip-turn',{side:'B',slot:0},{switchToId:'a3',priority:0,speed:90}),action('B','b1','roar',{side:'A',slot:0},{priority:-6,speed:100}),action('B','b2','roar',{side:'A',slot:1},{priority:-6,speed:90})];
 assert.equal(validateTurnActions(double,commands,{validateAction:validate}).code,'INVALID_SWITCH');
});

test('r3-forced-switch:single damaging phazing chooses a seeded reserve only after damage',()=>{
 let result=resolveMove(fixture(),action('A','a1','circle-throw',{side:'B',slot:0}),runtime(.1,.99,.99,.99));assert.equal(result.battle.sides.B.active[0],'b4');assert.deepEqual(result.events.filter(event=>['damage','switchOut','switchIn','forcedSwitch'].includes(event.kind)).map(event=>event.kind),['damage','switchOut','switchIn','forcedSwitch']);
 const immune=fixture();immune.sides.B.roster[0].types=['fairy'];result=resolveMove(immune,action('A','a1','dragon-tail',{side:'B',slot:0}),runtime(.1));assert.equal(result.battle.sides.B.active[0],'b1');assert.equal(result.events.some(event=>event.kind==='forcedSwitch'),false);
});

test('Roar and Whirlwind force a switch without damage and bypass personal protection',()=>{
 for(const moveId of ['roar','whirlwind']){const battle=fixture();battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'protect',endTurnTimer:1};const result=resolveMove(battle,action('A','a1',moveId,{side:'B',slot:0}),runtime(.99));assert.equal(result.battle.sides.B.active[0],'b4');assert.equal(result.events.some(event=>event.kind==='moveBlocked'),false);assert.equal(result.events.some(event=>event.kind==='damage'),false);}
});

test('forced switching reports no reserve without undoing prior damage',()=>{
 const battle=fixture();battle.sides.B.roster.slice(1).forEach(entry=>entry.hp=0);const result=resolveMove(battle,action('A','a1','circle-throw',{side:'B',slot:0}),runtime(.1,.99,.99));assert.ok(result.battle.sides.B.roster[0].hp<200);assert.equal(result.battle.sides.B.active[0],'b1');assert.equal(result.events.at(-1).reason,'noReserve');
});

test('r3-pivot-switch:double replaces only the pivot user slot',()=>{
 const result=resolveMove(fixture('double'),action('A','a2','flip-turn',{side:'B',slot:0},{switchToId:'a3'}),runtime());assert.deepEqual(result.battle.sides.A.active,['a1','a3']);
});

test('r3-forced-switch:double changes only the selected target slot',()=>{
 const result=resolveMove(fixture('double'),action('A','a1','roar',{side:'B',slot:1}),runtime(.99));assert.deepEqual(result.battle.sides.B.active,['b1','b4']);
});

test('a forced-out actor loses its queued action in the authoritative turn resolver',()=>{
 const battle=fixture(),actions=[action('A','a1','roar',{side:'B',slot:0},{priority:-6,speed:100}),action('B','b1','late-negative',{side:'A',slot:0},{priority:-7,speed:100})];
 const result=resolveActionQueue(battle,actions,{move:(state,queued,turnRuntime)=>queued.moveId==='roar'?resolveMove(state,queued,turnRuntime):{battle:state,events:[{kind:'unexpectedMove',actorId:queued.actorId}]}});
 assert.equal(result.ok,true);assert.notEqual(result.battle.sides.B.active[0],'b1');assert.equal(result.events.some(event=>event.kind==='actionCancelled'&&event.actorId==='b1'),true);assert.equal(result.events.some(event=>event.kind==='unexpectedMove'),false);
});

test('r3-position-swap:single Ally Switch spends PP then fails without an active ally',()=>{
 const result=resolveMove(fixture(),action('A','a1','ally-switch'),runtime());assert.equal(result.battle.sides.A.roster[0].pp['ally-switch'],19);assert.deepEqual(result.battle.sides.A.active,['a1']);assert.equal(result.events.at(-1).reason,'requiresActiveAlly');
});

test('r3-position-swap:double swaps slots before a later slot-targeted move resolves',()=>{
 const swapped=resolveMove(fixture('double'),action('A','a1','ally-switch'),runtime());assert.deepEqual(swapped.battle.sides.A.active,['a2','a1']);
 const hit=resolveMove(swapped.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime());assert.ok(hit.battle.sides.A.roster[1].hp<200);assert.equal(hit.battle.sides.A.roster[0].hp,200);
});

test('Ally Switch consecutive attempts use the independent 1, 1/3 and 1/9 chain',()=>{
 let battle=resolveMove(fixture('double'),action('A','a1','ally-switch'),runtime()).battle;battle=endTurn(battle);let result=resolveMove(battle,action('A','a1','ally-switch'),runtime(.2));assert.equal(result.events.at(-1).kind,'positionsSwapped');assert.equal(result.battle.sides.A.roster[0].volatiles.allySwitch.counter,9);
 battle=endTurn(result.battle);result=resolveMove(battle,action('A','a1','ally-switch'),runtime(.2));assert.equal(result.events.at(-1).reason,'consecutiveFailure');assert.equal(result.battle.sides.A.roster[0].volatiles.allySwitch,undefined);
});

function endTurn(battle){const state=structuredClone(battle);state.phase='END_TURN';return resolveMechanicsEndTurn(state).battle;}
