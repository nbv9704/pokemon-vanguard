import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyProtect,applySideGuard,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['protect','detect','wide-guard','quick-guard','tackle','eruption','baby-doll-eyes'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`protect-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,rngState:1,eventSequence:0,events:[],result:null,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target});
const runtime={nextRandom:()=>.999};

test('r3-protection:single Protect blocks before accuracy and damage RNG',()=>{
 const battle=fixture(),before=JSON.stringify(battle),protectedResult=resolveMove(battle,action('A','a1','protect'),runtime);let calls=0;
 const attack=resolveMove(protectedResult.battle,action('B','b1','tackle',{side:'A',slot:0}),{nextRandom:()=>{calls++;return 0;}});
 assert.equal(JSON.stringify(battle),before);assert.equal(calls,0);assert.equal(attack.battle.sides.A.roster[0].hp,200);assert.deepEqual(attack.events.map(event=>event.kind),['moveStarted','ppSpent','moveBlocked']);assert.equal(attack.battle.sides.B.roster[0].pp.tackle,19);
});

test('consecutive protection uses 1, 1/3 and 1/9 gates and resets after failure',()=>{
 let battle=fixture(),first=applyProtect(battle,{actorId:'a1',moveId:'protect'});assert.equal(first.succeeded,true);assert.equal(first.battle.sides.A.roster[0].volatiles.stall.counter,3);
 battle=endTurn(first.battle);const second=applyProtect(battle,{actorId:'a1',moveId:'detect'},{nextRandom:()=>.2});assert.equal(second.succeeded,true);assert.equal(second.battle.sides.A.roster[0].volatiles.stall.counter,9);
 battle=endTurn(second.battle);const third=applyProtect(battle,{actorId:'a1',moveId:'protect'},{nextRandom:()=>.2});assert.equal(third.succeeded,false);assert.equal(third.battle.sides.A.roster[0].volatiles.stall,undefined);assert.equal(third.events[0].counter,9);
});

test('protection expires after one turn while its chain expires after a skipped turn',()=>{
 const first=applyProtect(fixture(),{actorId:'a1',moveId:'protect'}),afterOne=endTurn(first.battle),unitOne=afterOne.sides.A.roster[0];assert.equal(unitOne.volatiles.protect,undefined);assert.equal(unitOne.volatiles.stall.endTurnTimer,1);
 const afterTwo=endTurn(afterOne);assert.equal(afterTwo.sides.A.roster[0].volatiles.stall,undefined);
});

test('an explicitly reviewed bypass move ignores protection',()=>{
 const bypassManifests={...manifests,tackle:{...manifests.tackle,bypassesProtect:true}},bypassResolver=createMoveActionHandler({moves,manifests:bypassManifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),guarded=resolveMove(fixture(),action('A','a1','protect'),runtime);
 const result=bypassResolver(guarded.battle,action('B','b1','tackle',{side:'A',slot:0}),runtime);assert.ok(result.battle.sides.A.roster[0].hp<200);assert.equal(result.events.some(event=>event.kind==='moveBlocked'),false);
});

test('r3-protection:double blocks one protected spread target and damages the other',()=>{
 const battle=fixture('double'),guarded=resolveMove(battle,action('A','a1','detect'),runtime),result=resolveMove(guarded.battle,action('B','b1','eruption'),runtime);
 assert.equal(result.battle.sides.A.roster[0].hp,200);assert.ok(result.battle.sides.A.roster[1].hp<200);assert.equal(result.events.filter(event=>event.kind==='moveBlocked').length,1);assert.equal(result.events.filter(event=>event.kind==='damage').length,1);
});

test('r3-side-protection:single Wide Guard blocks a spread move and expires at end turn',()=>{
 const guarded=resolveMove(fixture(),action('A','a1','wide-guard'),runtime),attack=resolveMove(guarded.battle,action('B','b1','eruption'),runtime);assert.equal(attack.battle.sides.A.roster[0].hp,200);assert.equal(attack.events.find(event=>event.kind==='moveBlocked').reason,'wide-guard');
 const ended=endTurn(guarded.battle);assert.equal(ended.sides.A.conditions['wide-guard'],undefined);
});

test('Quick Guard blocks positive-priority targeting and shares the consecutive-use chain',()=>{
 const guarded=resolveMove(fixture(),action('A','a1','quick-guard'),runtime),attack=resolveMove(guarded.battle,action('B','b1','baby-doll-eyes',{side:'A',slot:0}),runtime);assert.equal(attack.events.find(event=>event.kind==='moveBlocked').reason,'quick-guard');assert.equal(attack.battle.sides.A.roster[0].stages.atk,0);
 const between=endTurn(guarded.battle),failed=applySideGuard(between,{side:'A',actorId:'a1',moveId:'wide-guard',guard:'wide-guard'},{nextRandom:()=>.5});assert.equal(failed.succeeded,false);assert.equal(failed.battle.sides.A.conditions?.['wide-guard'],undefined);
});

test('r3-side-protection:double Wide Guard protects both allies from one spread action',()=>{
 const guarded=resolveMove(fixture('double'),action('A','a1','wide-guard'),runtime),result=resolveMove(guarded.battle,action('B','b1','eruption'),runtime);assert.deepEqual(result.battle.sides.A.roster.slice(0,2).map(unit=>unit.hp),[200,200]);assert.equal(result.events.filter(event=>event.reason==='wide-guard').length,2);assert.equal(result.events.some(event=>event.kind==='damage'),false);
});

function endTurn(battle){const state=structuredClone(battle);state.phase='END_TURN';return resolveMechanicsEndTurn(state).battle;}
