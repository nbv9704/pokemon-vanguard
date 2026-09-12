import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,variableMovePower} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['facade','hex','venoshock','hard-press','fickle-beam'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`condition-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});
const sequence=values=>{let index=0;return {nextRandom:()=>values[index++]??.999};};
const power=result=>result.events.find(event=>event.kind==='powerResolved').power;

test('r3-condition-power:single status formulas distinguish user, any target status and poison',()=>{
 const facade=fixture();facade.sides.A.roster[0].status={id:'burn'};const facadeResult=resolveMove(facade,action('facade'),sequence([.999,.999]));assert.equal(power(facadeResult),140);assert.equal(facadeResult.events.find(event=>event.kind==='damage').breakdown.burn,1);
 const hex=fixture();hex.sides.B.roster[0].status={id:'paralysis'};assert.equal(power(resolveMove(hex,action('hex'),sequence([.999,.999]))),130);
 for(const status of ['poison','bad-poison']){const battle=fixture();battle.sides.B.roster[0].status={id:status};assert.equal(power(resolveMove(battle,action('venoshock'),sequence([.999,.999]))),130);}
});

test('condition power remains at base power when its condition is absent',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];
 assert.equal(variableMovePower('user-status-non-sleep',{battle,actor,target,basePower:70}),70);assert.equal(variableMovePower('target-status',{battle,actor,target,basePower:65}),65);assert.equal(variableMovePower('target-poison',{battle,actor,target,basePower:65}),65);
});

test('Hard Press follows the pinned fixed-point target HP formula',()=>{
 const full=fixture();assert.equal(power(resolveMove(full,action('hard-press'),sequence([.999,.999]))),100);
 const half=fixture();half.sides.B.roster[0].hp=100;assert.equal(power(resolveMove(half,action('hard-press'),sequence([.999,.999]))),50);
 const low=fixture();low.sides.B.roster[0].hp=1;low.sides.B.roster[0].maxHp=1000;assert.equal(power(resolveMove(low,action('hard-press'),sequence([.999,.999]))),1);
});

test('Fickle Beam uses one seeded 30 percent roll before hit RNG',()=>{
 assert.equal(power(resolveMove(fixture(),action('fickle-beam'),sequence([.299,.999,.999]))),160);assert.equal(power(resolveMove(fixture(),action('fickle-beam'),sequence([.3,.999,.999]))),80);
});

test('r3-condition-power:double resolves redirection before reading target status',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].volatiles.redirection={active:true,order:1};battle.sides.B.roster[1].status={id:'poison'};const result=resolveMove(battle,action('hex'),sequence([.999,.999]));
 assert.equal(power(result),130);assert.equal(result.events.find(event=>event.kind==='powerResolved').targetId,'b2');assert.equal(result.battle.sides.B.roster[0].hp,200);
});
