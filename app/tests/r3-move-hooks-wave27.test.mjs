import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyMechanicsSwitch,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,HANDLER_DEFINITIONS,resolveMechanicsEndTurn} from '../mechanics-v3/index.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promoted=['bind','fire-spin','infestation','sand-tomb','snap-trap','whirlpool','wrap','forests-curse','trick-or-treat','reflect-type','pollen-puff','pain-split'];
const support=['rapid-spin'];
const ids=[...promoted,...support],byId=Object.fromEntries(catalog.map(move=>[move.id,move])),moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const validateAction=createMoveChoiceValidator({moves,manifests:manifests.moves});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:3200,maxHp:3200,stats:{hp:3200,atk:220,def:180,spa:210,spd:170,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},buildSnapshot:{abilityId:null,itemId:null},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`wave27-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:27,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0},side='A',actorId='a1')=>({kind:'move',side,actorId,moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const evidence={single:['r3-move-hooks-wave27:single'],double:['r3-move-hooks-wave27:double']};
function setAbility(unit,id){unit.buildSnapshot.abilityId=id;unit.activeAbilityId=id;unit.passiveEffects=compilePassiveEffects({abilityId:id,manifests});}
function endTurn(battle){const next=structuredClone(battle);next.phase='END_TURN';return resolveMechanicsEndTurn(next);}

// Constant .5 safely lands all 85%+ accuracy checks and gives deterministic damage/binding duration.
const runtime={nextRandom:()=>.5};

test('r3-move-hooks-wave27:single promotes 12 moves across binding, type-state, and HP utility families',()=>{
 assert.equal(promoted.length,12);
 for(const id of promoted){assert.ok(manifests.moves[id],`${id}: manifest`);assert.deepEqual(manifests.moves[id].testEvidence,evidence,`${id}: evidence`);assert.equal(manifests.moves[id].handlers[0].id,'spend-pp');}
 for(const id of ['bind','infestation','snap-trap','wrap'])assert.equal(manifests.moves[id].contact,true,`${id}: contact`);
 for(const id of ['fire-spin','sand-tomb','whirlpool'])assert.equal(manifests.moves[id].contact,false,`${id}: non-contact`);
 assert.equal(manifests.moves['pollen-puff'].tags.includes('bullet'),true);assert.equal(manifests.moves['reflect-type'].bypassSubstitute,true);
});

test('binding moves seed 4-5 turn residual state and deal one-eighth max HP each end turn',()=>{
 for(const moveId of ['bind','fire-spin','infestation','sand-tomb','snap-trap','whirlpool','wrap']){
  const result=resolveMove(fixture(),action(moveId),runtime),target=result.battle.sides.B.roster[0],state=target.volatiles.bound;
  assert.ok(state,`${moveId}: bound state`);assert.ok([4,5].includes(state.endTurnTimer),`${moveId}: duration`);assert.equal(state.sourceActorId,'a1');assert.equal(state.sourceId,moveId);
  const residual=endTurn(result.battle);assert.equal(residual.ok,true);assert.equal(residual.battle.sides.B.roster[0].hp,target.hp-400,`${moveId}: 1/8 residual`);assert.ok(residual.events.some(e=>e.kind==='damage'&&e.targetId==='b1'&&e.source==='binding-residual'));
 }
});

test('binding requires real target HP damage, so Substitute absorbs the hit without applying the trap',()=>{
 const battle=fixture();battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:1600,maxHp:1600};const result=resolveMove(battle,action('infestation'),runtime);
 assert.ok(result.events.some(e=>e.kind==='substituteDamaged'));assert.equal(result.battle.sides.B.roster[0].volatiles.bound,undefined);assert.equal(result.battle.sides.B.roster[0].hp,3200);
});

test('bound blocks manual switching while the source is active, but Ghost targets can still switch',()=>{
 const result=resolveMove(fixture(),action('bind'),runtime),switchAction={kind:'switch',side:'B',actorId:'b1',toId:'b3'};
 const blocked=validateAction(result.battle,switchAction);assert.equal(blocked.ok,false);assert.equal(blocked.code,'BOUND_SWITCH_BLOCKED');assert.equal(blocked.sourceActorId,'a1');
 const ghost=structuredClone(result.battle);ghost.sides.B.roster[0].types=['ghost'];assert.deepEqual(validateAction(ghost,switchAction),{ok:true});
});

test('binding releases when its source leaves the field and Magic Guard suppresses residual damage without erasing state',()=>{
 let result=resolveMove(fixture(),action('bind'),runtime),switched=applyMechanicsSwitch(result.battle,'A','a1','a3',{manifests});assert.equal(switched.ok,true);
 let residual=endTurn(switched.battle);assert.equal(residual.battle.sides.B.roster[0].volatiles.bound,undefined);assert.ok(residual.events.some(e=>e.kind==='volatileEnded'&&e.volatile==='bound'&&e.reason==='sourceUnavailable'));assert.equal(residual.battle.sides.B.roster[0].hp,result.battle.sides.B.roster[0].hp);
 const battle=fixture();setAbility(battle.sides.B.roster[0],'magic-guard');result=resolveMove(battle,action('bind'),runtime);const timer=result.battle.sides.B.roster[0].volatiles.bound.endTurnTimer;residual=endTurn(result.battle);assert.equal(residual.battle.sides.B.roster[0].hp,result.battle.sides.B.roster[0].hp);assert.equal(residual.battle.sides.B.roster[0].volatiles.bound.endTurnTimer,timer-1);
});

test('Rapid Spin clears bound state only after a real damaging hit',()=>{
 let battle=fixture();battle.sides.A.roster[0].volatiles.bound={id:'bound',sourceId:'bind',sourceActorId:'b1',endTurnTimer:4,residualNumerator:1,residualDenominator:8,trapsSwitch:true};let result=resolveMove(battle,action('rapid-spin'),runtime);assert.equal(result.battle.sides.A.roster[0].volatiles.bound,undefined);assert.ok(result.events.some(e=>e.kind==='volatileEnded'&&e.volatile==='bound'&&e.reason==='rapid-spin'));
 battle=fixture();battle.sides.A.roster[0].volatiles.bound={id:'bound',sourceId:'bind',sourceActorId:'b1',endTurnTimer:4,residualNumerator:1,residualDenominator:8,trapsSwitch:true};battle.sides.B.roster[0].types=['ghost'];result=resolveMove(battle,action('rapid-spin'),runtime);assert.ok(result.battle.sides.A.roster[0].volatiles.bound,'immunity means Rapid Spin did not land a damaging hit');
});

test('Forest’s Curse and Trick-or-Treat add one type and reflect through Magic Bounce onto the original user',()=>{
 for(const [moveId,type] of [['forests-curse','grass'],['trick-or-treat','ghost']]){
  let battle=fixture();battle.sides.B.roster[0].types=['water','flying'];let result=resolveMove(battle,action(moveId),runtime);assert.deepEqual(result.battle.sides.B.roster[0].types,['water','flying',type]);
  battle=fixture();setAbility(battle.sides.B.roster[0],'magic-bounce');result=resolveMove(battle,action(moveId),runtime);assert.ok(result.battle.sides.A.roster[0].types.includes(type));assert.deepEqual(result.battle.sides.B.roster[0].types,['normal']);assert.ok(result.events.some(e=>e.kind==='moveReflected'&&e.abilityId==='magic-bounce'));
 }
});

test('Reflect Type bypasses Substitute, copies all current target types, and is not Magic Bounce-reflectable',()=>{
 const battle=fixture();battle.sides.B.roster[0].types=['water','flying'];battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:800,maxHp:800};setAbility(battle.sides.B.roster[0],'magic-bounce');const result=resolveMove(battle,action('reflect-type'),runtime);
 assert.deepEqual(result.battle.sides.A.roster[0].types,['water','flying']);assert.equal(result.events.some(e=>e.kind==='moveReflected'),false);assert.equal(result.events.some(e=>e.kind==='moveBlocked'&&e.reason==='substitute'),false);
});

test('Pollen Puff damages foes but heals the selected ally by half max HP without leaking damage',()=>{
 let battle=fixture('double');let result=resolveMove(battle,action('pollen-puff',{side:'B',slot:0}),runtime);assert.ok(result.events.some(e=>e.kind==='damage'&&e.targetId==='b1'&&e.moveId==='pollen-puff'));assert.equal(result.events.some(e=>e.kind==='heal'&&e.targetId==='b1'),false);
 battle=fixture('double');battle.sides.A.roster[1].hp=1000;result=resolveMove(battle,action('pollen-puff',{side:'A',slot:1}),runtime);assert.equal(result.battle.sides.A.roster[1].hp,2600);assert.ok(result.events.some(e=>e.kind==='heal'&&e.targetId==='a2'&&e.amount===1600));assert.equal(result.events.some(e=>e.kind==='damage'&&e.targetId==='a2'),false);
});

test('Pain Split floors the current-HP average, caps to max HP, and remains blocked by Substitute',()=>{
 let battle=fixture();battle.sides.A.roster[0].hp=701;battle.sides.B.roster[0].hp=2500;let result=resolveMove(battle,action('pain-split'),runtime);assert.equal(result.battle.sides.A.roster[0].hp,1600);assert.equal(result.battle.sides.B.roster[0].hp,1600);assert.ok(result.events.some(e=>e.kind==='hpEqualized'&&e.average===1600));
 battle=fixture();battle.sides.A.roster[0].hp=800;battle.sides.B.roster[0].hp=2400;battle.sides.B.roster[0].volatiles.substitute={id:'substitute',hp:800,maxHp:800};result=resolveMove(battle,action('pain-split'),runtime);assert.equal(result.battle.sides.A.roster[0].hp,800);assert.equal(result.battle.sides.B.roster[0].hp,2400);assert.ok(result.events.some(e=>e.kind==='moveBlocked'&&e.reason==='substitute'));
});

test('r3-move-hooks-wave27:double type-state and HP utility effects stay on the selected adjacent slot',()=>{
 const battle=fixture('double');battle.sides.B.roster[0].types=['water'];battle.sides.B.roster[1].types=['electric'];battle.sides.B.roster[0].hp=2600;battle.sides.B.roster[1].hp=1400;const typed=resolveMove(battle,action('forests-curse',{side:'B',slot:1}),runtime);assert.deepEqual(typed.battle.sides.B.roster[0].types,['water']);assert.deepEqual(typed.battle.sides.B.roster[1].types,['electric','grass']);
 const split=resolveMove(battle,action('pain-split',{side:'B',slot:1}),runtime);assert.equal(split.battle.sides.B.roster[0].hp,2600);assert.equal(split.battle.sides.B.roster[1].hp,2300);assert.equal(split.battle.sides.A.roster[0].hp,2300);
});
