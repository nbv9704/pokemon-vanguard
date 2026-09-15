import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyMechanicsSwitch,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,heldItemId} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['acrobatics','knock-off','thief','covet','corrosive-gas','poltergeist','skill-swap','role-play','entrainment','worry-seed'];
const ids=[...promoted],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:3000,maxHp:3000,stats:{hp:3000,atk:220,def:180,spa:180,spd:160,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`wave26-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:26,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const evidence={single:['r3-move-hooks-wave26:single'],double:['r3-move-hooks-wave26:double']};
function setItem(unit,id){unit.buildSnapshot.itemId=id;unit.itemState=createHeldItemState(id);unit.passiveEffects=[...unit.passiveEffects.filter(x=>x.sourceKind!=='item'),...compilePassiveEffects({itemId:id,manifests})];}
function setAbility(unit,id){unit.buildSnapshot.abilityId=id;unit.activeAbilityId=id;unit.passiveEffects=[...compilePassiveEffects({abilityId:id,manifests}),...unit.passiveEffects.filter(x=>x.sourceKind==='item')];}
const damage=result=>result.events.find(event=>event.kind==='damage'&&event.targetId==='b1'&&event.moveId);

test('r3-move-hooks-wave26:single promotes 10 moves across held-item and Ability-manipulation families',()=>{
 assert.equal(promoted.length,10);for(const id of promoted){assert.ok(manifests.moves[id],`${id}: manifest`);assert.deepEqual(manifests.moves[id].testEvidence,evidence);assert.equal(manifests.moves[id].handlers[0].id,'spend-pp');}
 assert.equal(manifests.moves.acrobatics.handlers[2].params.formula,'user-no-held-item');assert.equal(manifests.moves['skill-swap'].bypassSubstitute,true);assert.equal(manifests.moves['role-play'].bypassSubstitute,true);
});

test('Acrobatics doubles base power only when the user truly holds no item',()=>{
 let battle=fixture(),plain=resolveMove(battle,action('acrobatics'),{nextRandom:()=>.999});const boosted=damage(plain).amount;
 battle=fixture();setItem(battle.sides.A.roster[0],'leftovers');const held=resolveMove(battle,action('acrobatics'),{nextRandom:()=>.999});assert.ok(boosted>damage(held).amount*1.8);assert.equal(heldItemId(held.battle.sides.A.roster[0]),'leftovers');
});

test('Knock Off gets held-item power boost, removes the item after a real hit, and Sticky Hold blocks removal',()=>{
 let battle=fixture();setItem(battle.sides.B.roster[0],'leftovers');const result=resolveMove(battle,action('knock-off'),{nextRandom:()=>.999});assert.equal(heldItemId(result.battle.sides.B.roster[0]),null);assert.ok(result.events.some(e=>e.kind==='powerResolved'&&e.power===97));assert.ok(result.events.some(e=>e.kind==='itemRemoved'&&e.itemId==='leftovers'));
 battle=fixture();setItem(battle.sides.B.roster[0],'leftovers');setAbility(battle.sides.B.roster[0],'sticky-hold');const sticky=resolveMove(battle,action('knock-off'),{nextRandom:()=>.999});assert.equal(heldItemId(sticky.battle.sides.B.roster[0]),'leftovers');assert.ok(sticky.events.some(e=>e.kind==='itemRemovalBlocked'&&e.abilityId==='sticky-hold'));assert.ok(sticky.events.some(e=>e.kind==='powerResolved'&&e.power===97));
});

test('Thief and Covet steal only into an empty item slot and cannot steal through Substitute',()=>{
 for(const moveId of ['thief','covet']){let battle=fixture();setItem(battle.sides.B.roster[0],'leftovers');let result=resolveMove(battle,action(moveId),{nextRandom:()=>.999});assert.equal(heldItemId(result.battle.sides.A.roster[0]),'leftovers');assert.equal(heldItemId(result.battle.sides.B.roster[0]),null);battle=fixture();setItem(battle.sides.B.roster[0],'leftovers');battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};result=resolveMove(battle,action(moveId),{nextRandom:()=>.999});assert.equal(heldItemId(result.battle.sides.A.roster[0]),null);assert.equal(heldItemId(result.battle.sides.B.roster[0]),'leftovers');}
});

test('Poltergeist requires and reveals the target held item before accuracy resolves',()=>{
 let battle=fixture();let result=resolveMove(battle,action('poltergeist'),{nextRandom:()=>.999});assert.ok(result.events.some(e=>e.kind==='moveFailed'&&e.reason==='heldItemRequirement'));assert.equal(result.battle.sides.A.roster[0].pp['poltergeist'],pp()['poltergeist']-1);
 battle=fixture();setItem(battle.sides.B.roster[0],'leftovers');result=resolveMove(battle,action('poltergeist'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].itemState.revealed,true);assert.ok(result.events.some(e=>e.kind==='itemRevealed'&&e.itemId==='leftovers'));
});

test('Corrosive Gas removes held items from all hit adjacent units while respecting Sticky Hold',()=>{
 const battle=fixture('double');setItem(battle.sides.A.roster[1],'leftovers');setItem(battle.sides.B.roster[0],'life-orb');setItem(battle.sides.B.roster[1],'shell-bell');setAbility(battle.sides.B.roster[1],'sticky-hold');const result=resolveMove(battle,action('corrosive-gas'),{nextRandom:()=>.999});assert.equal(heldItemId(result.battle.sides.A.roster[1]),null);assert.equal(heldItemId(result.battle.sides.B.roster[0]),null);assert.equal(heldItemId(result.battle.sides.B.roster[1]),'shell-bell');assert.ok(result.events.some(e=>e.kind==='itemRemovalBlocked'&&e.targetId==='b2'));
});

test('Skill Swap and Role Play bypass Substitute and transient Ability changes restore on switch-out',()=>{
 let battle=fixture();setAbility(battle.sides.A.roster[0],'overgrow');setAbility(battle.sides.B.roster[0],'drought');battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};let result=resolveMove(battle,action('skill-swap'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'drought');assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'overgrow');assert.equal(result.battle.field.weather?.id,'sun');const switched=applyMechanicsSwitch(result.battle,'A','a1','a3',{manifests});assert.equal(switched.battle.sides.A.roster[0].activeAbilityId,'overgrow');
 battle=fixture();setAbility(battle.sides.A.roster[0],'overgrow');setAbility(battle.sides.B.roster[0],'drought');battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:500,maxHp:500};result=resolveMove(battle,action('role-play'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'drought');assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'drought');
});

test('Entrainment is Magic Bounce-reflectable and copies the reflector Ability back onto the user',()=>{
 const battle=fixture();setAbility(battle.sides.A.roster[0],'overgrow');setAbility(battle.sides.B.roster[0],'magic-bounce');const result=resolveMove(battle,action('entrainment'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'magic-bounce');assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'magic-bounce');assert.ok(result.events.some(e=>e.kind==='moveReflected'&&e.abilityId==='magic-bounce'));
});

test('Worry Seed installs Insomnia, cures sleep, and reflection applies both effects to the original user',()=>{
 let battle=fixture();setAbility(battle.sides.B.roster[0],'overgrow');battle.sides.B.roster[0].status={id:'sleep',counter:2};let result=resolveMove(battle,action('worry-seed'),{nextRandom:()=>.999});assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'insomnia');assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(e=>e.kind==='statusCured'&&e.targetId==='b1'));
 battle=fixture();setAbility(battle.sides.A.roster[0],'overgrow');battle.sides.A.roster[0].status={id:'sleep',counter:2};setAbility(battle.sides.B.roster[0],'magic-bounce');result=resolveMove(battle,action('worry-seed'),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'insomnia');assert.equal(result.battle.sides.A.roster[0].status,null);assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'magic-bounce');
});

test('r3-move-hooks-wave26:double selected Ability operations do not spill onto the other active slot',()=>{
 const battle=fixture('double');setAbility(battle.sides.A.roster[0],'overgrow');setAbility(battle.sides.B.roster[0],'drought');setAbility(battle.sides.B.roster[1],'sticky-hold');const result=resolveMove(battle,action('role-play',{side:'B',slot:0}),{nextRandom:()=>.999});assert.equal(result.battle.sides.A.roster[0].activeAbilityId,'drought');assert.equal(result.battle.sides.B.roster[0].activeAbilityId,'drought');assert.equal(result.battle.sides.B.roster[1].activeAbilityId,'sticky-hold');
});
