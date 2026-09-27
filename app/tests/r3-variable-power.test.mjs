import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,variableMovePower} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['flail','reversal','electro-ball','gyro-ball','eruption','water-spout','stored-power','power-trip','last-respects'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];return {id:`variable-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});
const resolvedPower=result=>result.events.find(event=>event.kind==='powerResolved').power;

test('variable power formulas cover HP, speed, positive stages and fainted allies',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];
 assert.equal(variableMovePower('low-user-hp',{battle,actor,target}),20);actor.hp=1;assert.equal(variableMovePower('low-user-hp',{battle,actor,target}),200);
 actor.hp=100;assert.equal(variableMovePower('user-hp-proportional',{battle,actor,target,basePower:150}),75);
 actor.stats.spe=200;assert.equal(variableMovePower('faster-user',{battle,actor,target}),80);assert.equal(variableMovePower('slower-user',{battle,actor:target,target:actor}),51);
 actor.stages.atk=2;actor.stages.spe=1;actor.stages.def=-3;assert.equal(variableMovePower('positive-stages',{battle,actor,target,basePower:20}),80);
 battle.sides.A.roster[1].hp=0;battle.sides.A.roster[2].hp=0;assert.equal(variableMovePower('fainted-allies',{battle,actor,target,basePower:50}),150);
});

test('r3-variable-power:single resolves each reviewed formula before ordinary damage',()=>{
 const low=fixture();low.sides.A.roster[0].hp=1;assert.equal(resolvedPower(resolveMove(low,action('flail'),runtime)),200);
 const fast=fixture();fast.sides.A.roster[0].stats.spe=500;assert.equal(resolvedPower(resolveMove(fast,action('electro-ball'),runtime)),150);
 const boosted=fixture();boosted.sides.A.roster[0].stages={...stages(),spa:2,spe:1};assert.equal(resolvedPower(resolveMove(boosted,action('stored-power'),runtime)),80);
 const fallen=fixture();fallen.sides.A.roster[1].hp=0;fallen.sides.A.roster[2].hp=0;assert.equal(resolvedPower(resolveMove(fallen,action('last-respects'),runtime)),150);
});

test('HP-proportional power uses the user snapshot and reaches a minimum of one',()=>{
 const half=fixture();half.sides.A.roster[0].hp=100;assert.equal(resolvedPower(resolveMove(half,action('eruption'),runtime)),75);
 const low=fixture();low.sides.A.roster[0].hp=1;low.sides.A.roster[0].maxHp=1000;assert.equal(resolvedPower(resolveMove(low,action('water-spout'),runtime)),1);
});

test('r3-variable-power:double resolves spread power per hit and applies the spread modifier',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].hp=100;const result=resolveMove(battle,action('eruption'),runtime),powers=result.events.filter(event=>event.kind==='powerResolved'),damage=result.events.filter(event=>event.kind==='damage');
 assert.deepEqual(powers.map(event=>event.power),[75,75]);assert.equal(damage.length,2);assert.ok(damage.every(event=>event.breakdown.spread===.75));assert.ok(result.battle.sides.B.roster.slice(0,2).every(unit=>unit.hp<200));
});
