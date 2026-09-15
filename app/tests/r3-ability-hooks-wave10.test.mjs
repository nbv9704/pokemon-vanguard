import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 activateHeldItem,abilityPowerModifiers,applyVolatileStatus,compilePassiveEffects,createHeldItemState,effectiveBattleSpeed,
 heldItemId,modifyMoveByAbility,prepareTurnOrderAbilities,resolveEndTurnAbilityAllyStatusCures,resolveEndTurnAbilityBerryRestores,
 resolveEntryAbilities,resolveOutgoingAbilitySecondaries,resolveTargetAbilityBlock,typeEffectivenessWithHeldItems,unitIsGrounded,validateMechanicManifest
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['aroma-veil','klutz','levitate','pixilate','refrigerate','poison-touch','stench','quick-draw','unnerve','scrappy','harvest','healer','unburden','gale-wings','prankster','stall'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},maxPp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave10-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const move=(id='hit',type='normal',category='physical',power=60)=>({id,name:id,type,category,power,accuracy:100,maxPP:16,contact:false});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:false,tags:[],handlers:[],...overrides});

for(const format of ['single','double'])test(`r3-ability-hooks-wave10:${format} compiles and validates all promoted abilities`,()=>{
 for(const id of ids){assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceId===id&&effect.sourceKind==='ability'),id);}
});

test('Aroma Veil protects holder and allies from move-locking volatiles without blocking confusion',()=>{
 let battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('aroma-veil');battle.sides.B.roster[0].lastMoveId='hit';battle.sides.B.roster[0].pp.hit=16;
 let result=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'taunt',volatile:'taunt'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.taunt,undefined);assert.equal(result.events[0].sourceAbilityId,'aroma-veil');assert.equal(result.events[0].sourceActorId,'b2');
 result=applyVolatileStatus(result.battle,{actorId:'a1',targetId:'b2',moveId:'disable',volatile:'disable'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[1].volatiles.disable,undefined);
 result=applyVolatileStatus(result.battle,{actorId:'a1',targetId:'b1',moveId:'torment',volatile:'torment'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.torment,undefined);
 result=applyVolatileStatus(result.battle,{actorId:'a1',targetId:'b1',moveId:'confuse-ray',volatile:'confusion'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.confusion.id,'confusion');
});

test('Klutz suppresses held-item effects without consuming or deleting the item',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.itemState=createHeldItemState('choice-scarf');actor.passiveEffects=[...effects('klutz'),...effects(null,'choice-scarf')];
 assert.equal(effectiveBattleSpeed(battle,actor),100);assert.equal(heldItemId(actor),'choice-scarf');assert.equal(actor.itemState.consumed,false);
});

test('Levitate grants Ground immunity and airborne hazard state, while grounding items override it',()=>{
 let battle=fixture();let target=battle.sides.B.roster[0];target.passiveEffects=effects('levitate');assert.equal(typeEffectivenessWithHeldItems('ground',target,battle),0);assert.equal(unitIsGrounded(target,battle),false);
 battle=fixture();target=battle.sides.B.roster[0];target.itemState=createHeldItemState('iron-ball');target.passiveEffects=[...effects('levitate'),...effects(null,'iron-ball')];assert.equal(unitIsGrounded(target,battle),true);assert.equal(typeEffectivenessWithHeldItems('ground',target,battle),1);
});

test('Pixilate and Refrigerate convert Normal moves and apply their shared 1.2 power boost',()=>{
 for(const [id,type] of [['pixilate','fairy'],['refrigerate','ice']]){const actor=unit('a1',{passiveEffects:effects(id)}),base=move('return','normal','physical',100),modified=modifyMoveByAbility(actor,base,mechanics());assert.equal(modified.move.type,type,id);assert.equal(abilityPowerModifiers(actor,modified.move,modified.mechanics).apply(100),120,id);assert.equal(modified.applied[0].kind,'move-type-conversion');}
});

test('Poison Touch and Stench use deterministic outgoing secondary rolls with eligibility guards',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('poison-touch');let result=resolveOutgoingAbilitySecondaries(battle,{actorId:'a1',move:move('punch'),mechanics:mechanics({contact:true}),damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status.id,'poison');assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='poison-touch'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('poison-touch');result=resolveOutgoingAbilitySecondaries(battle,{actorId:'a1',move:move('beam','normal','special'),mechanics:mechanics({contact:false}),damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('stench');result=resolveOutgoingAbilitySecondaries(battle,{actorId:'a1',move:move('slam'),mechanics:mechanics(),damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch.id,'flinch');
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('stench');result=resolveOutgoingAbilitySecondaries(battle,{actorId:'a1',move:move('headbutt'),mechanics:mechanics({secondaryEffects:[{kind:'volatile-status',chance:30,volatile:'flinch'}]}),damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);
});

test('Quick Draw applies a seeded same-priority order boost but does not alter move priority',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('quick-draw');const actions=[{kind:'move',side:'A',actorId:'a1',moveId:'hit',moveType:'normal',moveCategory:'physical',priority:0,speed:50},{kind:'move',side:'B',actorId:'b1',moveId:'hit',moveType:'normal',moveCategory:'physical',priority:1,speed:200}];const result=prepareTurnOrderAbilities(battle,actions,{nextRandom:()=>0});const action=result.actions.find(entry=>entry.actorId==='a1');assert.equal(action.orderBoost,1);assert.equal(action.priority,0);assert.equal(action.turnOrderAbilityIds[0],'quick-draw');
});

test('Unnerve suppresses opposing Berry consumption while leaving the Berry held',()=>{
 const battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('unnerve');const actor=battle.sides.A.roster[0];actor.itemState=createHeldItemState('sitrus-berry');actor.passiveEffects=effects(null,'sitrus-berry');const result=activateHeldItem(battle,{actorId:'a1',itemId:'sitrus-berry',reason:'threshold',consume:true});assert.equal(result.applied,false);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,false);assert.ok(result.events.some(event=>event.kind==='itemActivationBlocked'&&event.abilityId==='unnerve'));
});

test('Scrappy bypasses Ghost immunity for Normal/Fighting and blocks Intimidate attack drops',()=>{
 let battle=fixture();const actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.passiveEffects=effects('scrappy');target.types=['ghost'];assert.equal(typeEffectivenessWithHeldItems('normal',target,battle,{attacker:actor}),1);assert.equal(typeEffectivenessWithHeldItems('fighting',target,battle,{attacker:actor}),1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('scrappy');battle.sides.B.roster[0].passiveEffects=effects('intimidate');const result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'B',actorId:'b1'}]);assert.equal(result.battle.sides.A.roster[0].stages.atk,0);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.sourceAbilityId==='scrappy'));
});

test('Harvest restores consumed Berries deterministically and is guaranteed in sun',()=>{
 let battle=fixture();let actor=battle.sides.A.roster[0];actor.passiveEffects=effects('harvest');actor.itemState=createHeldItemState('sitrus-berry');actor.itemState.consumed=true;let result=resolveEndTurnAbilityBerryRestores(battle);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,false);assert.ok(result.events.some(event=>event.kind==='itemRestored'&&event.abilityId==='harvest'));
 battle=fixture();battle.rngState=0xffffffff;battle.field.weather={id:'sun',remaining:2};actor=battle.sides.A.roster[0];actor.passiveEffects=effects('harvest');actor.itemState=createHeldItemState('sitrus-berry');actor.itemState.consumed=true;result=resolveEndTurnAbilityBerryRestores(battle);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,false);
});

test('Healer cures an active ally only and uses seeded battle RNG',()=>{
 let battle=fixture('double');battle.sides.A.roster[1].passiveEffects=effects('healer');battle.sides.A.roster[0].status={id:'burn'};let result=resolveEndTurnAbilityAllyStatusCures(battle);assert.equal(result.battle.sides.A.roster[0].status,null);assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.sourceId==='a2'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('healer');battle.sides.A.roster[0].status={id:'burn'};result=resolveEndTurnAbilityAllyStatusCures(battle);assert.equal(result.battle.sides.A.roster[0].status.id,'burn');
});

test('Unburden doubles Speed only while the original held item is consumed and drops on restore',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.passiveEffects=effects('unburden');actor.itemState=createHeldItemState('sitrus-berry');assert.equal(effectiveBattleSpeed(battle,actor),100);actor.itemState.consumed=true;assert.equal(effectiveBattleSpeed(battle,actor),200);actor.itemState.consumed=false;assert.equal(effectiveBattleSpeed(battle,actor),100);
});

test('Gale Wings grants +1 only to Flying moves at full HP',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.passiveEffects=effects('gale-wings');let result=prepareTurnOrderAbilities(battle,[{kind:'move',side:'A',actorId:'a1',moveId:'air-slash',moveType:'flying',moveCategory:'special',priority:0,speed:100}],{});assert.equal(result.actions[0].priority,1);actor.hp=319;result=prepareTurnOrderAbilities(battle,[{kind:'move',side:'A',actorId:'a1',moveId:'air-slash',moveType:'flying',moveCategory:'special',priority:0,speed:100}],{});assert.equal(result.actions[0].priority,0);
});

test('Prankster grants status priority and its boosted status move fails against Dark targets',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.passiveEffects=effects('prankster');battle.sides.B.roster[0].types=['dark'];const prepared=prepareTurnOrderAbilities(battle,[{kind:'move',side:'A',actorId:'a1',moveId:'taunt',moveType:'dark',moveCategory:'status',priority:0,speed:100}],{});assert.equal(prepared.actions[0].priority,1);const block=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'b1',move:move('taunt','dark','status',0),mechanics:mechanics({priority:1,turnOrderAbilityIds:prepared.actions[0].turnOrderAbilityIds})});assert.equal(block.blocked,true);assert.equal(block.events[0].sourceId,'a1');assert.equal(block.events.at(-1).abilityId,'prankster');battle.sides.A.roster.push(unit('a2',{types:['dark']}));battle.sides.A.active.push('a2');const ally=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'a2',move:move('help','normal','status',0),mechanics:mechanics({priority:1,turnOrderAbilityIds:prepared.actions[0].turnOrderAbilityIds})});assert.equal(ally.blocked,false);
});

test('Stall applies a negative same-priority order modifier without reducing move priority',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('stall');const result=prepareTurnOrderAbilities(battle,[{kind:'move',side:'A',actorId:'a1',moveId:'hit',moveType:'normal',moveCategory:'physical',priority:0,speed:200}],{});assert.equal(result.actions[0].orderBoost,-1);assert.equal(result.actions[0].priority,0);
});
