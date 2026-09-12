import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const moveList=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-11/normalized/moves.json',import.meta.url),'utf8'));
const ids=['double-edge','brave-bird','wild-charge','head-smash','giga-drain','drain-punch','draining-kiss','horn-leech'];
const moves=Object.fromEntries(moveList.filter(move=>ids.includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:120,spd:100,spe:100},pp:Object.fromEntries(ids.map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`linked-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});

test('r3-recoil-drain:single recoil uses actual capped target damage',()=>{
 const battle=fixture();battle.sides.B.roster[0].hp=10;
 const result=resolveMove(battle,action('double-edge'),runtime),recoil=result.events.find(event=>event.source==='recoil');
 assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(recoil.amount,3);assert.equal(result.battle.sides.A.roster[0].hp,197);
});

test('recoil ratios round like Showdown and can faint the user',()=>{
 const battle=fixture();battle.sides.A.roster[0].hp=1;const result=resolveMove(battle,action('wild-charge'),runtime);
 assert.equal(result.battle.sides.A.roster[0].hp,0);assert.equal(result.events.find(event=>event.source==='recoil').amount,1);assert.equal(result.events.at(-1).kind,'fainted');
});

test('drain heals from actual damage and respects the user HP cap',()=>{
 const battle=fixture();battle.sides.A.roster[0].hp=190;const result=resolveMove(battle,action('draining-kiss'),runtime),damage=result.events.find(event=>event.kind==='damage'),heal=result.events.find(event=>event.kind==='heal');
 assert.equal(heal.amount,Math.min(10,Math.max(1,Math.round(damage.amount*3/4))));assert.equal(result.battle.sides.A.roster[0].hp,200);
 const low=fixture();low.sides.A.roster[0].hp=100;low.sides.B.roster[0].hp=1;const limited=resolveMove(low,action('giga-drain'),runtime);assert.equal(limited.events.find(event=>event.kind==='heal').amount,1);
});

test('zero damage creates neither recoil nor drain',()=>{
 for(const moveId of ['double-edge','drain-punch']){const battle=fixture();battle.sides.B.roster[0].types=['ghost'];const result=resolveMove(battle,action(moveId),runtime);assert.equal(result.events.some(event=>['recoil','drain'].includes(event.source)),false);}
});

test('r3-recoil-drain:double follows redirection and applies one aggregate linked effect',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].hp=100;battle.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const result=resolveMove(battle,action('horn-leech'),runtime);
 assert.equal(result.battle.sides.B.roster[0].hp,200);assert.ok(result.battle.sides.B.roster[1].hp<200);assert.equal(result.events.filter(event=>event.kind==='heal').length,1);assert.ok(result.battle.sides.A.roster[0].hp>100);
});
