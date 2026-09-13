import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyDamageHit,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn,sideConditionDamageModifiers,speedWithSideConditions} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const ids=['tailwind','reflect','light-screen'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{tailwind:16,reflect:20,'light-screen':20},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`side-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(entry=>entry.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(entry=>entry.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});

test('r3-side-conditions:single Tailwind lasts four turns and cannot be reset while active',()=>{
 const battle=fixture(),before=structuredClone(battle),first=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId:'tailwind'},{});
 assert.deepEqual(battle,before);assert.equal(first.battle.sides.A.conditions.tailwind.remaining,4);assert.equal(first.events.at(-1).remaining,4);assert.equal(first.battle.sides.B.conditions.tailwind,undefined);
 const again=resolveMove(first.battle,{kind:'move',side:'A',actorId:'a1',moveId:'tailwind'},{});assert.equal(again.events.at(-1).reason,'sideConditionAlreadyActive');assert.equal(again.battle.sides.A.conditions.tailwind.remaining,4);
});

test('Light Clay extends Reflect and Light Screen to eight turns but never extends Tailwind',()=>{
 for(const moveId of ['reflect','light-screen']){const battle=fixture();battle.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'light-clay',manifests});const result=resolveMove(battle,{kind:'move',side:'A',actorId:'a1',moveId},{});assert.equal(result.battle.sides.A.conditions[moveId].remaining,8);assert.equal(result.events.at(-1).sourceItemId,'light-clay');}
 const tailwind=fixture();tailwind.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'light-clay',manifests});assert.equal(resolveMove(tailwind,{kind:'move',side:'A',actorId:'a1',moveId:'tailwind'},{}).battle.sides.A.conditions.tailwind.remaining,4);
});

test('r3-side-conditions:double Tailwind doubles only its side and can reorder waiting actors',()=>{
 const battle=fixture('double');battle.sides.A.conditions.tailwind={id:'tailwind',remaining:3};
 assert.equal(speedWithSideConditions(101,battle.sides.A.roster[0],battle),202);assert.equal(speedWithSideConditions(101,battle.sides.B.roster[0],battle),101);
});

test('Reflect and Light Screen reduce matching damage, use the Double modifier and yield to critical hits',()=>{
 const physical={id:'physical-hit',type:'normal',category:'physical',power:80},special={...physical,id:'special-hit',category:'special'},damage=(format,condition,move,critical=false)=>{const battle=fixture(format);battle.sides.B.conditions[condition]={id:condition,remaining:4};const rolls=[critical?0:.99,.99];return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move},{nextRandom:()=>rolls.shift()}).events[0];};
 const plain=(()=>{const battle=fixture();const rolls=[.99,.99];return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:physical},{nextRandom:()=>rolls.shift()}).events[0];})();
 const reflected=damage('single','reflect',physical),wrong=damage('single','light-screen',physical),double=damage('double','reflect',physical),critical=damage('single','reflect',physical,true);
 assert.ok(reflected.amount<plain.amount);assert.equal(wrong.amount,plain.amount);assert.ok(double.amount>reflected.amount&&double.amount<plain.amount);assert.equal(reflected.breakdown.sideConditionModifiers[0].sourceId,'reflect');assert.equal(critical.breakdown.sideConditionModifiers.length,0);assert.equal(sideConditionDamageModifiers(fixture(),unit('x'),special).values.length,0);
});

test('persistent side-condition counters tick once and expire alongside one-turn guards',()=>{
 const battle=fixture();battle.phase='END_TURN';battle.sides.A.conditions.tailwind={id:'tailwind',remaining:1};battle.sides.A.conditions['wide-guard']={id:'wide-guard',endTurnTimer:1};
 const result=resolveMechanicsEndTurn(battle),ended=result.events.filter(event=>event.kind==='sideConditionEnded');
 assert.deepEqual(ended.map(event=>event.condition).sort(),['tailwind','wide-guard']);assert.deepEqual(result.battle.sides.A.conditions,{});
});
