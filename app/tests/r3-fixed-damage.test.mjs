import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['night-shade','seismic-toss','super-fang'],moves=Object.fromEntries(allMoves.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,types=['normal'])=>({actorId,types,hp:201,maxHp:201,stats:{hp:201,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1',['ghost']),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`fixed-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>0};
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});

test('r3-fixed-damage:single level damage and current-HP fraction bypass ordinary modifiers',()=>{
 const levelBattle=fixture();levelBattle.sides.B.roster[0].types=['psychic'];const level=resolveMove(levelBattle,action('night-shade'),runtime),levelDamage=level.events.find(event=>event.kind==='damage');
 assert.equal(levelDamage.amount,50);assert.equal(levelDamage.breakdown.fixed,true);assert.equal(levelDamage.breakdown.formula,'user-level');
 const fang=resolveMove(fixture(),action('super-fang'),runtime),fraction=fang.events.find(event=>event.kind==='damage');assert.equal(fraction.amount,100);assert.equal(fraction.breakdown.requested,100);
});

test('fixed damage respects type immunity and never consumes crit or damage rolls',()=>{
 const battle=fixture();battle.sides.B.roster[0].types=['normal'];let calls=0;const result=resolveMove(battle,action('night-shade'),{nextRandom:()=>{calls++;return 0;}});
 assert.equal(calls,0);assert.equal(result.events.find(event=>event.kind==='damage').amount,0);assert.equal(result.battle.sides.B.roster[0].hp,201);
});

test('Super Fang floors odd current HP, has a minimum of one, and cannot faint from full damage',()=>{
 const odd=resolveMove(fixture(),action('super-fang'),runtime);assert.equal(odd.battle.sides.B.roster[0].hp,101);
 const low=fixture();low.sides.B.roster[0].hp=1;const result=resolveMove(low,action('super-fang'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.events.find(event=>event.kind==='damage').amount,1);
});

test('r3-fixed-damage:double resolves redirection before applying one fixed hit',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].volatiles.redirection={active:true,order:1};const result=resolveMove(battle,action('seismic-toss'),runtime);
 assert.equal(result.battle.sides.B.roster[0].hp,201);assert.equal(result.battle.sides.B.roster[1].hp,151);assert.equal(result.events.find(event=>event.kind==='damage').targetId,'b2');
});
