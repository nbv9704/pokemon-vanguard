import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyDamageHit,compilePassiveEffects,passiveDamageModifiers} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const move=(type='grass',category='special')=>({id:'beta-strike',type,category,power:80});
const unit=(actorId,overrides={})=>({actorId,types:['grass'],hp:100,maxHp:100,stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},status:null,volatiles:{},stages:stages(),...overrides});
const battle=(attacker,format='single')=>({id:`passive-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:format==='single'?1:2,sides:{A:{active:['a1'],roster:[attacker]},B:{active:['b1'],roster:[unit('b1',{types:['normal']})]}}});
const runtime={nextRandom:()=>.999};

function damageWith({abilityId=null,itemId=null,hp=100,type='grass',category='special',format='single'}={}){
 const attacker=unit('a1',{hp,types:[type],passiveEffects:compilePassiveEffects({abilityId,itemId,manifests})});
 return applyDamageHit(battle(attacker,format),{actorId:'a1',targetId:'b1',move:move(type,category)},runtime).events[0];
}

test('r3-passive-damage:single low-HP abilities require both threshold and matching move type',()=>{
 const active=damageWith({abilityId:'overgrow',hp:33}),healthy=damageWith({abilityId:'overgrow',hp:34}),wrongType=damageWith({abilityId:'overgrow',hp:1,type:'water'});
 assert.deepEqual(active.breakdown.passiveModifiers,[{sourceKind:'ability',sourceId:'overgrow',kind:'low-hp-type-boost',multiplier:1.5}]);
 assert.ok(active.amount>healthy.amount);assert.equal(healthy.breakdown.passiveModifiers.length,0);assert.equal(wrongType.breakdown.passiveModifiers.length,0);
});

test('ability and held item modifiers stack deterministically without mutating the battle',()=>{
 const effects=compilePassiveEffects({abilityId:'overgrow',itemId:'miracle-seed',manifests}),attacker=unit('a1',{hp:20,passiveEffects:effects}),before=battle(attacker),snapshot=structuredClone(before);
 const result=applyDamageHit(before,{actorId:'a1',targetId:'b1',move:move()},runtime),modifiers=result.events[0].breakdown.passiveModifiers;
 assert.deepEqual(modifiers.map(entry=>entry.multiplier),[1.5,1.2]);assert.deepEqual(modifiers.map(entry=>entry.sourceId),['overgrow','miracle-seed']);assert.deepEqual(before,snapshot);
 assert.equal(result.events[0].amount,damageWith({abilityId:'overgrow',itemId:'miracle-seed',hp:20}).amount);
});

test('category held items apply only to their declared damage category',()=>{
 const physical=passiveDamageModifiers({passiveEffects:compilePassiveEffects({itemId:'muscle-band',manifests})},move('normal','physical'));
 const special=passiveDamageModifiers({passiveEffects:compilePassiveEffects({itemId:'wise-glasses',manifests})},move('normal','special'));
 const mismatch=passiveDamageModifiers({passiveEffects:compilePassiveEffects({itemId:'muscle-band',manifests})},move('normal','special'));
 assert.deepEqual(physical.values,[1.1]);assert.deepEqual(special.values,[1.1]);assert.deepEqual(mismatch.values,[]);
});

test('r3-passive-damage:double retains passive modifiers alongside spread damage',()=>{
 const normal=damageWith({abilityId:'torrent',itemId:'mystic-water',hp:30,type:'water',format:'double'}),spreadAttacker=unit('a1',{hp:30,types:['water'],passiveEffects:compilePassiveEffects({abilityId:'torrent',itemId:'mystic-water',manifests})});
 const spread=applyDamageHit(battle(spreadAttacker,'double'),{actorId:'a1',targetId:'b1',move:move('water'),spread:true},runtime).events[0];
 assert.deepEqual(spread.breakdown.passiveModifiers.map(entry=>entry.sourceId),['torrent','mystic-water']);assert.ok(spread.breakdown.damage<normal.breakdown.damage);
});

test('passive compiler rejects undeclared ability and item IDs',()=>{
 assert.throws(()=>compilePassiveEffects({abilityId:'missing',manifests}),/unsupported ability/);
 assert.throws(()=>compilePassiveEffects({itemId:'missing',manifests}),/unsupported item/);
});
