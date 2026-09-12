import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,selectHitCount} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const moves={
 'bullet-seed':{id:'bullet-seed',type:'grass',category:'physical',power:25,accuracy:100},
 'rock-blast':{id:'rock-blast',type:'rock',category:'physical',power:25,accuracy:90},
 'icicle-spear':{id:'icicle-spear',type:'ice',category:'physical',power:25,accuracy:100},
 'dual-wingbeat':{id:'dual-wingbeat',type:'flying',category:'physical',power:40,accuracy:90},
 'scale-shot':{id:'scale-shot',type:'dragon',category:'physical',power:25,accuracy:90}
};
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=actorId=>({actorId,types:['normal'],hp:200,maxHp:200,stats:{hp:200,atk:120,def:100,spa:100,spd:100,spe:100},pp:Object.fromEntries(Object.keys(moves).map(id=>[id,20])),status:null,volatiles:{},stages:stages()});
function fixture(format='single'){const n=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`multi-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:n,sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b}}};}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target});
const sequence=values=>{let index=0;return {nextRandom:()=>values[index++]??.999};};

test('2-5 hit selection follows the modern 35/35/15/15 distribution',()=>{
 assert.deepEqual([.349,.35,.699,.70,.849,.85,.999].map(roll=>selectHitCount([2,5],()=>roll)),[2,3,3,4,4,5,5]);
 assert.equal(selectHitCount(2,()=>{throw new Error('fixed count must not consume RNG');}),2);
});

test('r3-multi-hit:single rolls hit count once, damages per hit, and spends one PP',()=>{
 const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,action('bullet-seed'),sequence([.1,.999,.999,.999,.999]));
 const damage=result.events.filter(event=>event.kind==='damage'),count=result.events.find(event=>event.kind==='hitCount');
 assert.equal(JSON.stringify(battle),before);assert.equal(damage.length,2);assert.deepEqual(damage.map(event=>event.hit),[1,2]);assert.equal(count.plannedHits,2);assert.equal(count.hitCount,2);assert.equal(result.battle.sides.A.roster[0].pp['bullet-seed'],19);
});

test('multi-hit stops immediately after fainting and reports actual hits and total damage',()=>{
 const battle=fixture();battle.sides.B.roster[0].hp=1;
 const result=resolveMove(battle,action('bullet-seed'),sequence([.999,.999,.999]));
 assert.equal(result.events.filter(event=>event.kind==='damage').length,1);assert.equal(result.events.find(event=>event.kind==='hitCount').hitCount,1);assert.equal(result.events.find(event=>event.kind==='damage').amount,1);assert.equal(result.battle.sides.B.roster[0].hp,0);
});

test('r3-multi-hit:double resolves redirection once before the full sequence',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const result=resolveMove(battle,action('dual-wingbeat'),sequence([0,.999,.999,.999,.999]));
 assert.equal(result.battle.sides.B.roster[0].hp,200);assert.equal(result.events.filter(event=>event.kind==='damage').length,2);assert.ok(result.battle.sides.B.roster[1].hp<200);assert.equal(result.events.find(event=>event.kind==='hitCount').targetId,'b2');
});

test('r3-multi-hit-self:single applies Scale Shot self stages once after a damaging sequence',()=>{
 const result=resolveMove(fixture(),action('scale-shot'),sequence([0,.1,.999,.999,.999,.999]));const actor=result.battle.sides.A.roster[0];
 assert.deepEqual({def:actor.stages.def,spe:actor.stages.spe},{def:-1,spe:1});assert.equal(result.events.filter(event=>event.kind==='statStageChanged').length,2);
});

test('r3-multi-hit-self:double boosts only the user after redirected Scale Shot damage',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].volatiles.redirection={active:true,order:1};const result=resolveMove(battle,action('scale-shot'),sequence([0,.1,.999,.999,.999,.999]));
 assert.equal(result.events.find(event=>event.kind==='damage').targetId,'b2');assert.equal(result.battle.sides.A.roster[0].stages.spe,1);assert.equal(result.battle.sides.A.roster[1].stages.spe,0);
});
