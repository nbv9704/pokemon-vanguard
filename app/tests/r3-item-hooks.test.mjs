import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {accuracyWithHeldItems,activateHeldItem,applyChoiceItemMoveLock,applyDamageHit,applyMajorStatus,applySecondaryEffects,applyVolatileStatus,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,createMoveChoiceValidator,checkAccuracyHandler,criticalChanceWithHeldItems,HANDLER_DEFINITIONS,resolveAfterMoveItems,resolveEntryHazards,resolveMechanicsEndTurn,resolveProtectionBlock,speedWithHeldItems,tryBeforeMoveConditions,tryConfusionAction} from '../mechanics-v3/index.mjs';
import {applySwitch} from '../rules-v3/lifecycle.mjs';
import {applyRecoilHandler} from '../mechanics-v3/handlers/apply-recoil.mjs';
import {applyStatStagesHandler} from '../mechanics-v3/handlers/apply-stat-stages.mjs';
import {fixedDamageHandler} from '../mechanics-v3/handlers/fixed-damage.mjs';
import {applyRoomHandler} from '../mechanics-v3/handlers/apply-room.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const maxRoll={nextRandom:()=>.999};
const move=(id,power=60)=>({id,name:id,type:'normal',category:'physical',power,accuracy:100,priority:0,targetMode:'opponent',contact:true,tags:[]});
const unit=(actorId,{itemId=null,hp=160,maxHp=160,status=null,types=['normal'],atk=160,def=100}={})=>({
 actorId,types,hp,maxHp,stats:{hp:maxHp,atk,def,spa:120,spd:120,spe:100},pp:{},status,volatiles:{},stages:stages(),
 buildSnapshot:{itemId},itemState:createHeldItemState(itemId),passiveEffects:compilePassiveEffects({itemId,manifests})
});
function fixture(format='single',{targetItem=null,targetHp=160,targetStatus=null,targetTypes=['normal'],field={}}={}){
 const count=format==='double'?2:1,a=[unit('a1',{atk:200}),unit('a2')],b=[unit('b1',{itemId:targetItem,hp:targetHp,status:targetStatus,types:targetTypes}),unit('b2')];
 return {id:`items-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:19,field,sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}

for(const format of ['single','double'])test(`r3-item-hooks:${format}`,()=>{
 const battle=fixture(format,{targetItem:'focus-sash'}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-lethal',220)},maxRoll),target=result.battle.sides.B.roster[0];
 assert.equal(target.hp,1);assert.equal(target.itemState.consumed,true);assert.equal(target.itemState.revealed,true);
 assert.deepEqual(result.events.filter(event=>event.kind.startsWith('item')).map(event=>event.kind),['itemRevealed','itemActivated','itemConsumed']);
 assert.equal(result.events.find(event=>event.kind==='damage').breakdown.itemSurvival.sourceId,'focus-sash');
});

test('Leftovers heals 1/16 before poison residual and reveals only on activation',()=>{
 const battle=fixture('single',{targetItem:'leftovers',targetHp:80,targetStatus:{id:'poison'}});battle.phase='END_TURN';
 const result=resolveMechanicsEndTurn(battle),target=result.battle.sides.B.roster[0],itemIndex=result.events.findIndex(event=>event.kind==='itemActivated'),poisonIndex=result.events.findIndex(event=>event.kind==='damage'&&event.source==='major-status-residual');
 assert.equal(target.hp,70);assert.ok(itemIndex>=0&&poisonIndex>itemIndex);assert.equal(target.itemState.revealed,true);assert.equal(target.itemState.consumed,false);
 assert.equal(result.events.find(event=>event.kind==='heal'&&event.source==='leftovers').amount,10);
});

test('Magic Room suppresses persistent recovery and consumable survival without consuming either item',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:4}}};
 let battle=fixture('single',{targetItem:'leftovers',targetHp:80,field});battle.phase='END_TURN';let result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.B.roster[0].hp,80);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,false);
 battle=fixture('single',{targetItem:'focus-sash',field});result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-lethal',220)},maxRoll);assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);assert.ok(!result.events.some(event=>event.kind.startsWith('item')));
});


test('Choice Scarf boosts Speed by 50 percent without revealing and Magic Room suppresses the boost',()=>{
 const battle=fixture('single',{targetItem:'choice-scarf'}),holder=battle.sides.B.roster[0];holder.stats.spe=101;
 assert.ok(holder.passiveEffects.some(effect=>effect.kind==='item-speed-boost'&&effect.sourceId==='choice-scarf'&&effect.multiplier===1.5));assert.ok(holder.passiveEffects.some(effect=>effect.kind==='item-choice-lock'&&effect.sourceId==='choice-scarf'));
 assert.equal(speedWithHeldItems(holder.stats.spe,holder,battle),151);assert.equal(holder.itemState.revealed,false);
 const suppressed=structuredClone(battle);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:4}};assert.equal(speedWithHeldItems(holder.stats.spe,suppressed.sides.B.roster[0],suppressed),101);assert.equal(suppressed.sides.B.roster[0].itemState.revealed,false);
});

test('Choice Scarf command lock persists through restart, is suppressed by Magic Room, and clears on switch',()=>{
 let battle=fixture('single',{targetItem:'choice-scarf'}),locked=applyChoiceItemMoveLock(battle,{actorId:'b1',moveId:'test-one'});battle=locked.battle;assert.equal(locked.applied,true);assert.equal(battle.sides.B.roster[0].volatiles['choice-lock'].moveId,'test-one');assert.equal(battle.sides.B.roster[0].itemState.revealed,false);
 const moves={'test-one':move('test-one'),'test-two':move('test-two')},validate=createMoveChoiceValidator({moves});assert.deepEqual(validate(battle,{kind:'move',side:'B',actorId:'b1',moveId:'test-one'}),{ok:true});assert.deepEqual(validate(battle,{kind:'move',side:'B',actorId:'b1',moveId:'test-two'}),{ok:false,code:'CHOICE_LOCKED_MOVE_REQUIRED',itemId:'choice-scarf',requiredMoveId:'test-one'});assert.deepEqual(validate(battle,{kind:'switch',side:'B',actorId:'b1',toId:'b2'}),{ok:true});
 const restarted=JSON.parse(JSON.stringify(battle));assert.equal(restarted.sides.B.roster[0].volatiles['choice-lock'].moveId,'test-one');restarted.field.rooms={'magic-room':{id:'magic-room',remaining:2}};assert.deepEqual(validate(restarted,{kind:'move',side:'B',actorId:'b1',moveId:'test-two'}),{ok:true});delete restarted.field.rooms;assert.equal(validate(restarted,{kind:'move',side:'B',actorId:'b1',moveId:'test-two'}).code,'CHOICE_LOCKED_MOVE_REQUIRED');
 const switched=applySwitch(restarted,'B','b1','b2');assert.equal(switched.ok,true);assert.deepEqual(switched.battle.sides.B.roster[0].volatiles,{});
});

test('Choice Scarf establishes no lock when the before-action gate cancels the move or while Magic Room is active',()=>{
 const catalogMove=move('test-choice'),choiceManifest={id:'test-choice',handlers:[],testEvidence:{single:['r3-item-hooks:single'],double:['r3-item-hooks:double']}},cancelled=createMoveActionHandler({moves:{'test-choice':catalogMove},manifests:{'test-choice':choiceManifest},registry:createHookRegistry(HANDLER_DEFINITIONS),beforeAction:battle=>({cancelled:true,battle:structuredClone(battle),events:[{kind:'actionPrevented',reason:'fixture'}]})});
 let battle=fixture('single',{targetItem:null});const holder=battle.sides.A.roster[0];holder.buildSnapshot.itemId='choice-scarf';holder.itemState=createHeldItemState('choice-scarf');holder.passiveEffects=compilePassiveEffects({itemId:'choice-scarf',manifests});let result=cancelled(battle,{kind:'move',side:'A',actorId:'a1',moveId:'test-choice'},maxRoll);assert.equal(result.battle.sides.A.roster[0].volatiles['choice-lock'],undefined);
 battle=fixture('single',{targetItem:'choice-scarf',field:{rooms:{'magic-room':{id:'magic-room',remaining:3}}}});const suppressed=applyChoiceItemMoveLock(battle,{actorId:'b1',moveId:'test-choice'});assert.equal(suppressed.applied,false);assert.equal(suppressed.battle.sides.B.roster[0].volatiles['choice-lock'],undefined);
});

test('White Herb restores every negative stage to zero after a primary stat drop while preserving positive stages',()=>{
 for(const format of ['single','double']){
  const battle=fixture(format,{targetItem:'white-herb'}),target=battle.sides.B.roster[0];target.stages.spa=2;
  const payload={action:{kind:'move',side:'A',actorId:'a1',target:{side:'B',slot:0}},move:{id:'white-herb-primary'},mechanics:{targetMode:'adjacentFoe',redirectable:true}};
  const result=applyStatStagesHandler.run({battle,payload,params:{boosts:{atk:-2,def:-1}}}),after=result.battle.sides.B.roster[0];
  assert.equal(after.stages.atk,0);assert.equal(after.stages.def,0);assert.equal(after.stages.spa,2);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.activationCount,1);
  assert.deepEqual(result.events.filter(event=>event.kind.startsWith('item')).map(event=>event.kind),['itemRevealed','itemActivated','itemConsumed']);assert.equal(result.events.filter(event=>event.kind==='statStageChanged'&&event.itemId==='white-herb').length,2);
 }
});

test('White Herb does not activate when a stat drop never becomes negative',()=>{
 const battle=fixture('single',{targetItem:'white-herb'}),target=battle.sides.B.roster[0];target.stages.atk=2;
 const payload={action:{kind:'move',side:'A',actorId:'a1',target:{side:'B',slot:0}},move:{id:'white-herb-nonnegative'},mechanics:{targetMode:'adjacentFoe',redirectable:true}};
 const result=applyStatStagesHandler.run({battle,payload,params:{boosts:{atk:-1}}}),after=result.battle.sides.B.roster[0];assert.equal(after.stages.atk,1);assert.equal(after.itemState.consumed,false);assert.equal(after.itemState.revealed,false);assert.ok(!result.events.some(event=>event.kind.startsWith('item')));
});

test('White Herb also resolves secondary stat drops and King Shield attack retaliation',()=>{
 let battle=fixture('single',{targetItem:'white-herb'}),result=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'white-herb-secondary',effects:[{kind:'stat-stages',chance:100,boosts:{def:-1}}]},maxRoll),after=result.battle.sides.B.roster[0];
 assert.equal(after.stages.def,0);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.secondary===true&&event.after===-1));assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.itemId==='white-herb'&&event.after===0));
 battle=fixture('single',{targetItem:'white-herb'});battle.sides.A.roster[0].volatiles.protect={id:'protect',sourceId:'kings-shield',retaliation:'lower-attack',blocksStatus:true,endTurnTimer:1};result=resolveProtectionBlock(battle,{targetRef:{actorId:'a1',side:'A',slot:0},actorId:'b1',move:{id:'contact-fixture',category:'physical'},mechanics:{contact:true,targetMode:'adjacentFoe'}});after=result.battle.sides.B.roster[0];
 assert.equal(after.stages.atk,0);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.moveId==='kings-shield'&&event.after===-1));assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.itemId==='white-herb'&&event.after===0));
});

test('Magic Room suppresses White Herb, then recast, natural expiry, or restart before-action releases the stored drop',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:4}}};let battle=fixture('single',{targetItem:'white-herb',field}),payload={action:{kind:'move',side:'A',actorId:'a1',target:{side:'B',slot:0}},move:{id:'white-herb-suppressed'},mechanics:{targetMode:'adjacentFoe',redirectable:true}},result=applyStatStagesHandler.run({battle,payload,params:{boosts:{atk:-2}}});
 let after=result.battle.sides.B.roster[0];assert.equal(after.stages.atk,-2);assert.equal(after.itemState.consumed,false);assert.equal(after.itemState.revealed,false);
 result=applyRoomHandler.run({battle:result.battle,payload:{action:{actorId:'a1'},move:{id:'magic-room'}},params:{room:'magic-room',turns:5}});after=result.battle.sides.B.roster[0];assert.equal(after.stages.atk,0);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='statStageChanged'&&event.itemId==='white-herb'));
 battle=fixture('single',{targetItem:'white-herb',field:{rooms:{'magic-room':{id:'magic-room',remaining:1}}}});battle.sides.B.roster[0].stages.def=-1;battle.phase='END_TURN';result=resolveMechanicsEndTurn(battle);after=result.battle.sides.B.roster[0];assert.equal(after.stages.def,0);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='roomEnded'&&event.room==='magic-room'));
 battle=fixture('single',{targetItem:'white-herb'});battle.sides.B.roster[0].stages.spe=-1;const restarted=JSON.parse(JSON.stringify(battle));result=tryBeforeMoveConditions(restarted,{kind:'move',side:'B',actorId:'b1',moveId:'fixture'},maxRoll);after=result.battle.sides.B.roster[0];assert.equal(after.stages.spe,0);assert.equal(after.itemState.consumed,true);
});

test('Sitrus Berry triggers after actual move damage at half HP or lower, heals 1/4 max HP, and consumes once',()=>{
 const battle=fixture('single',{targetItem:'sitrus-berry',targetHp:100}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-medium',60)},maxRoll),target=result.battle.sides.B.roster[0];
 const damage=result.events.find(event=>event.kind==='damage'&&event.moveId==='test-medium'),heal=result.events.find(event=>event.kind==='heal'&&event.source==='sitrus-berry');
 assert.ok(damage.hpAfter<=80&&damage.hpAfter>0);assert.equal(heal.amount,40);assert.equal(target.hp,damage.hpAfter+40);assert.equal(target.itemState.consumed,true);assert.equal(target.itemState.activationCount,1);
 const restarted=JSON.parse(JSON.stringify(result.battle)),again=applyDamageHit(restarted,{actorId:'a1',targetId:'b1',move:move('test-chip',20)},maxRoll),againTarget=again.battle.sides.B.roster[0];
 assert.equal(againTarget.itemState.activationCount,1);assert.ok(!again.events.some(event=>event.kind.startsWith('item')));assert.ok(!again.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});

test('Sitrus Berry does not trigger when damage misses the threshold or when the holder faints',()=>{
 let battle=fixture('single',{targetItem:'sitrus-berry',targetHp:160}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-chip',20)},maxRoll);assert.ok(result.battle.sides.B.roster[0].hp>80);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
 battle=fixture('single',{targetItem:'sitrus-berry',targetHp:35});result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-lethal',220)},maxRoll);assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
});

test('Focus Sash requires full HP and is not a generic lethal-damage reducer below full HP',()=>{
 const battle=fixture('single',{targetItem:'focus-sash',targetHp:159}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('test-lethal',220)},maxRoll),target=result.battle.sides.B.roster[0];
 assert.equal(target.hp,0);assert.equal(target.itemState.consumed,false);assert.equal(target.itemState.revealed,false);
});

test('item activation keys are idempotent and serialized state preserves the receipt',()=>{
 const battle=fixture('single',{targetItem:'sitrus-berry'}),first=activateHeldItem(battle,{actorId:'b1',itemId:'sitrus-berry',reason:'test',activationKey:'receipt-1'}),persisted=JSON.parse(JSON.stringify(first.battle)),second=activateHeldItem(persisted,{actorId:'b1',itemId:'sitrus-berry',reason:'test',activationKey:'receipt-1'});
 assert.equal(first.applied,true);assert.equal(second.applied,false);assert.equal(second.idempotent,true);assert.equal(second.battle.sides.B.roster[0].itemState.activationCount,1);assert.deepEqual(second.events,[]);
});


test('Sitrus Berry activates between supported residual groups instead of after a cumulative faint',()=>{
 const battle=fixture('single',{targetItem:'sitrus-berry',targetHp:30,targetStatus:{id:'poison'},field:{weather:{id:'sun',remaining:4}}}),target=battle.sides.B.roster[0];battle.phase='END_TURN';target.passiveEffects=compilePassiveEffects({abilityId:'solar-power',itemId:'sitrus-berry',manifests});
 const result=resolveMechanicsEndTurn(battle),after=result.battle.sides.B.roster[0];assert.equal(after.hp,30);assert.equal(after.itemState.consumed,true);
 const consumeIndex=result.events.findIndex(event=>event.kind==='itemConsumed'&&event.itemId==='sitrus-berry'),poisonIndex=result.events.findIndex(event=>event.kind==='damage'&&event.source==='major-status-residual');assert.ok(consumeIndex>=0&&poisonIndex>consumeIndex);
});

test('Sitrus Berry activates immediately after entry-hazard damage before the next entry effect',()=>{
 const battle=fixture('single',{targetItem:'sitrus-berry',targetHp:100});battle.sides.B.conditions['stealth-rock']={id:'stealth-rock',layers:1,sourceActorId:'a1',sourceMoveId:'stealth-rock',order:1};
 const result=resolveEntryHazards(battle,[{kind:'switchIn',actorId:'b1',side:'B',slot:0}]),target=result.battle.sides.B.roster[0];assert.equal(target.hp,120);assert.equal(target.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='damage'&&event.hazard==='stealth-rock'));assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});

test('Sitrus Berry activates after surviving recoil damage',()=>{
 const battle=fixture('single',{targetItem:null});const actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='sitrus-berry';actor.itemState=createHeldItemState('sitrus-berry');actor.passiveEffects=compilePassiveEffects({itemId:'sitrus-berry',manifests});actor.hp=70;
 const result=applyRecoilHandler.run({battle,payload:{action:{actorId:'a1'},move:{id:'test-recoil'},totalDamage:80},params:{numerator:1,denominator:4}}),after=result.battle.sides.A.roster[0];assert.equal(after.hp,90);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});

test('Focus Sash also protects against lethal fixed move damage and records the adjusted breakdown',()=>{
 const battle=fixture('single',{targetItem:'focus-sash'});battle.level=200;const move={id:'test-fixed',type:'normal',category:'physical'},mechanics={targetMode:'adjacentFoe',redirectable:true},payload={action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move,mechanics};
 const result=fixedDamageHandler.run({battle,payload,params:{formula:'user-level'}}),target=result.battle.sides.B.roster[0],damage=result.events.find(event=>event.kind==='damage');assert.equal(target.hp,1);assert.equal(target.itemState.consumed,true);assert.equal(damage.breakdown.itemSurvival.sourceId,'focus-sash');assert.equal(damage.amount,159);
});


test('Sitrus Berry activates after surviving confusion self-damage',()=>{
 const battle=fixture('single',{targetItem:null}),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='sitrus-berry';actor.itemState=createHeldItemState('sitrus-berry');actor.passiveEffects=compilePassiveEffects({itemId:'sitrus-berry',manifests});actor.hp=90;actor.volatiles.confusion={id:'confusion',timer:3};
 const result=tryConfusionAction(battle,{actorId:'a1'},{nextRandom:()=>0}),after=result.battle.sides.A.roster[0];assert.equal(result.cancelled,true);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='damage'&&event.moveId==='confusion'));assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});

test('Sitrus Berry activates after surviving Spiky Shield retaliation',()=>{
 const battle=fixture('single',{targetItem:'sitrus-berry',targetHp:90}),defender=battle.sides.A.roster[0];defender.volatiles.protect={id:'protect',sourceId:'spiky-shield',retaliation:'spiky-damage',blocksStatus:true,endTurnTimer:1};
 const result=resolveProtectionBlock(battle,{targetRef:{actorId:'a1',side:'A',slot:0},actorId:'b1',move:{id:'tackle',category:'physical'},mechanics:{contact:true,targetMode:'adjacentFoe'}}),after=result.battle.sides.B.roster[0];assert.equal(result.blocked,true);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='damage'&&event.source==='protection'));assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});


const cureCases=[
 ['cheri-berry','paralysis'],['chesto-berry','sleep'],['pecha-berry','poison'],['pecha-berry','bad-poison'],['rawst-berry','burn'],['aspear-berry','freeze']
];
for(const format of ['single','double'])test(`status-cure berry family cures matching major status immediately:${format}`,()=>{
 for(const [itemId,status] of cureCases){
  const battle=fixture(format,{targetItem:itemId}),result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'test-status',status},maxRoll),target=result.battle.sides.B.roster[0];
  assert.equal(target.status,null,`${itemId} should cure ${status}`);assert.equal(target.itemState.consumed,true);assert.equal(target.itemState.activationCount,1);
  assert.ok(result.events.some(event=>event.kind==='statusApplied'&&event.status===status));assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.status===status&&event.itemId===itemId));
 }
});

test('Persim Berry cures confusion immediately while a nonmatching berry stays hidden and unconsumed',()=>{
 let battle=fixture('single',{targetItem:'persim-berry'}),result=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'test-confuse',volatile:'confusion'},maxRoll),target=result.battle.sides.B.roster[0];
 assert.equal(target.volatiles.confusion,undefined);assert.equal(target.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.volatile==='confusion'&&event.itemId==='persim-berry'));
 battle=fixture('single',{targetItem:'cheri-berry'});result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'test-burn',status:'burn'},maxRoll);target=result.battle.sides.B.roster[0];
 assert.equal(target.status.id,'burn');assert.equal(target.itemState.consumed,false);assert.equal(target.itemState.revealed,false);assert.ok(!result.events.some(event=>event.kind.startsWith('item')));
});

test('Lum Berry cures a major status and confusion together with one activation',()=>{
 const battle=fixture('single',{targetItem:'lum-berry'}),target=battle.sides.B.roster[0];target.volatiles.confusion={id:'confusion',timer:4};
 const result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'test-burn',status:'burn'},maxRoll),after=result.battle.sides.B.roster[0];
 assert.equal(after.status,null);assert.equal(after.volatiles.confusion,undefined);assert.equal(after.itemState.consumed,true);assert.equal(after.itemState.activationCount,1);
 assert.equal(result.events.filter(event=>event.kind==='itemActivated').length,1);assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.status==='burn'));assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.volatile==='confusion'));
});

test('Magic Room suppresses a status berry, then natural expiry cures before the next turn',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:1}}},battle=fixture('single',{targetItem:'cheri-berry',field});
 let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'test-paralyze',status:'paralysis'},maxRoll);assert.equal(result.battle.sides.B.roster[0].status.id,'paralysis');assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);
 result.battle.phase='END_TURN';result=resolveMechanicsEndTurn(result.battle);const after=result.battle.sides.B.roster[0],roomEnd=result.events.findIndex(event=>event.kind==='roomEnded'&&event.room==='magic-room'),cure=result.events.findIndex(event=>event.kind==='statusCured'&&event.itemId==='cheri-berry'),turnEnd=result.events.findIndex(event=>event.kind==='turnEnded');
 assert.equal(after.status,null);assert.equal(after.itemState.consumed,true);assert.ok(roomEnd>=0&&cure>roomEnd&&turnEnd>cure);
});

test('recasting Magic Room off immediately releases suppressed status berries',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:4}}},battle=fixture('single',{targetItem:'persim-berry',field}),target=battle.sides.B.roster[0];target.volatiles.confusion={id:'confusion',timer:3};
 const result=applyRoomHandler.run({battle,payload:{action:{actorId:'a1'},move:{id:'magic-room'}},params:{room:'magic-room',turns:5}}),after=result.battle.sides.B.roster[0];
 assert.equal(result.payload.roomToggledOff,true);assert.equal(after.volatiles.confusion,undefined);assert.equal(after.itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='roomEnded'&&event.reason==='recast'));assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.itemId==='persim-berry'));
});


test('Life Orb boosts all damaging moves, then recoils 1/10 max HP once after a damaging move',()=>{
 const battle=fixture('single'),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='life-orb';actor.itemState=createHeldItemState('life-orb');actor.passiveEffects=compilePassiveEffects({itemId:'life-orb',manifests});
 const hit=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('life-orb-hit',60),mechanics:{contact:true}},maxRoll),damage=hit.events.find(event=>event.kind==='damage'&&event.moveId==='life-orb-hit');
 assert.ok(damage.breakdown.passiveModifiers.some(effect=>effect.sourceId==='life-orb'&&effect.kind==='held-damage-boost'));
 const before=hit.battle.sides.A.roster[0].hp,afterMove=resolveAfterMoveItems(hit.battle,{actorId:'a1',move:move('life-orb-hit',60),mechanics:{handlers:[]},totalDamage:hit.amount}),after=afterMove.battle.sides.A.roster[0];
 assert.equal(before-after.hp,16);assert.equal(after.itemState.consumed,false);assert.equal(after.itemState.revealed,true);assert.equal(after.itemState.activationCount,1);assert.ok(afterMove.events.some(event=>event.kind==='damage'&&event.itemId==='life-orb'&&event.reason==='post-move-recoil'));
});

test('Shell Bell heals 1/8 of aggregate move damage and does not reveal at full HP',()=>{
 let battle=fixture('single'),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='shell-bell';actor.itemState=createHeldItemState('shell-bell');actor.passiveEffects=compilePassiveEffects({itemId:'shell-bell',manifests});actor.hp=100;
 let result=resolveAfterMoveItems(battle,{actorId:'a1',move:move('shell-bell-hit'),mechanics:{handlers:[]},totalDamage:80}),after=result.battle.sides.A.roster[0];assert.equal(after.hp,110);assert.equal(after.itemState.revealed,true);assert.ok(result.events.some(event=>event.kind==='heal'&&event.itemId==='shell-bell'&&event.amount===10));
 battle=fixture('single');const full=battle.sides.A.roster[0];full.buildSnapshot.itemId='shell-bell';full.itemState=createHeldItemState('shell-bell');full.passiveEffects=compilePassiveEffects({itemId:'shell-bell',manifests});result=resolveAfterMoveItems(battle,{actorId:'a1',move:move('shell-bell-full'),mechanics:{handlers:[]},totalDamage:80});assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);assert.ok(!result.events.some(event=>event.kind.startsWith('item')));
});

test('Rocky Helmet damages a contact attacker by 1/6 max HP for each actual hit and can activate as its holder faints',()=>{
 let battle=fixture('single',{targetItem:'rocky-helmet'}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('contact-one',20),mechanics:{contact:true},hit:1},maxRoll);assert.equal(result.battle.sides.A.roster[0].hp,134);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,true);assert.equal(result.battle.sides.B.roster[0].itemState.activationCount,1);
 result=applyDamageHit(result.battle,{actorId:'a1',targetId:'b1',move:move('contact-one',20),mechanics:{contact:true},hit:2},maxRoll);assert.equal(result.battle.sides.A.roster[0].hp,108);assert.equal(result.battle.sides.B.roster[0].itemState.activationCount,2);
 battle=fixture('single',{targetItem:'rocky-helmet',targetHp:1});battle.sides.A.roster[0].hp=20;result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('contact-ko',60),mechanics:{contact:true}},maxRoll);assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.A.roster[0].hp,0);assert.ok(result.events.some(event=>event.kind==='itemActivated'&&event.itemId==='rocky-helmet'));assert.ok(result.events.some(event=>event.kind==='fainted'&&event.targetId==='a1'));
});

test('Rocky Helmet respects contact removal and can trigger the attacker Sitrus Berry after retaliation',()=>{
 let battle=fixture('single',{targetItem:'rocky-helmet'}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('long-reach-fixture',20),mechanics:{contact:false}},maxRoll);assert.equal(result.battle.sides.A.roster[0].hp,160);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,false);
 battle=fixture('single',{targetItem:'rocky-helmet'});const actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='sitrus-berry';actor.itemState=createHeldItemState('sitrus-berry');actor.passiveEffects=compilePassiveEffects({itemId:'sitrus-berry',manifests});actor.hp=90;result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('helmet-threshold',20),mechanics:{contact:true}},maxRoll);assert.equal(result.battle.sides.A.roster[0].hp,104);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='heal'&&event.source==='sitrus-berry'));
});

test('Magic Room suppresses Life Orb, Rocky Helmet, and Shell Bell without revealing them',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:4}}};let battle=fixture('single',{targetItem:'rocky-helmet',field}),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='life-orb';actor.itemState=createHeldItemState('life-orb');actor.passiveEffects=compilePassiveEffects({itemId:'life-orb',manifests});
 let hit=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('magic-room-contact',60),mechanics:{contact:true}},maxRoll);assert.equal(hit.battle.sides.A.roster[0].hp,160);assert.equal(hit.battle.sides.A.roster[0].itemState.revealed,false);assert.equal(hit.battle.sides.B.roster[0].itemState.revealed,false);let after=resolveAfterMoveItems(hit.battle,{actorId:'a1',move:move('magic-room-contact',60),mechanics:{handlers:[]},totalDamage:hit.amount});assert.equal(after.battle.sides.A.roster[0].hp,160);assert.equal(after.battle.sides.A.roster[0].itemState.revealed,false);
 battle=fixture('single',{field});actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='shell-bell';actor.itemState=createHeldItemState('shell-bell');actor.passiveEffects=compilePassiveEffects({itemId:'shell-bell',manifests});actor.hp=100;after=resolveAfterMoveItems(battle,{actorId:'a1',move:move('magic-room-heal'),mechanics:{handlers:[]},totalDamage:80});assert.equal(after.battle.sides.A.roster[0].hp,100);assert.equal(after.battle.sides.A.roster[0].itemState.revealed,false);
});

test('Sheer Force and forced-switch moves suppress AfterMoveSecondarySelf-style Life Orb recoil and Shell Bell recovery',()=>{
 for(const itemId of ['life-orb','shell-bell']){
  let battle=fixture('single'),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId=itemId;actor.itemState=createHeldItemState(itemId);actor.passiveEffects=compilePassiveEffects({itemId,manifests});actor.hp=100;
  let result=resolveAfterMoveItems(battle,{actorId:'a1',move:move('sheer-force-fixture'),mechanics:{handlers:[],secondaryEffectsSuppressed:true},totalDamage:80});assert.equal(result.battle.sides.A.roster[0].hp,100);assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);
  result=resolveAfterMoveItems(battle,{actorId:'a1',move:move('force-switch-fixture'),mechanics:{handlers:[{id:'apply-forced-switch'}]},totalDamage:80});assert.equal(result.battle.sides.A.roster[0].hp,100);assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);
 }
});


test('Rocky Helmet also retaliates against supported contact fixed-damage moves but not non-contact fixed damage',()=>{
 let battle=fixture('single',{targetItem:'rocky-helmet'}),fixedMove={id:'seismic-toss-fixture',type:'fighting',category:'physical'},mechanics={targetMode:'adjacentFoe',redirectable:true,contact:true},payload={action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:fixedMove,mechanics};
 let result=fixedDamageHandler.run({battle,payload,params:{formula:'user-level'}});assert.equal(result.battle.sides.A.roster[0].hp,134);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,true);assert.ok(result.events.some(event=>event.kind==='damage'&&event.itemId==='rocky-helmet'));
 battle=fixture('single',{targetItem:'rocky-helmet'});fixedMove={...fixedMove,id:'non-contact-fixed-fixture'};mechanics={...mechanics,contact:false};payload={...payload,move:fixedMove,mechanics};result=fixedDamageHandler.run({battle,payload,params:{formula:'user-level'}});assert.equal(result.battle.sides.A.roster[0].hp,160);assert.equal(result.battle.sides.B.roster[0].itemState.revealed,false);
});

const resistanceBerryByType={fire:'occa-berry',water:'passho-berry',electric:'wacan-berry',grass:'rindo-berry',ice:'yache-berry',fighting:'chople-berry',poison:'kebia-berry',ground:'shuca-berry',flying:'coba-berry',psychic:'payapa-berry',bug:'tanga-berry',rock:'charti-berry',ghost:'kasib-berry',dragon:'haban-berry',dark:'colbur-berry',steel:'babiri-berry',fairy:'roseli-berry'};

for(const format of ['single','double'])test(`Resistance berries halve the first matching super-effective hit in ${format} and persist consumption`,()=>{
 const attack={...move('resist-fire',60),type:'fire'},plain=applyDamageHit(fixture(format,{targetTypes:['grass']}),{actorId:'a1',targetId:'b1',move:attack},maxRoll),battle=fixture(format,{targetItem:'occa-berry',targetTypes:['grass']}),first=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack,hit:1},maxRoll),target=first.battle.sides.B.roster[0],damage=first.events.find(event=>event.kind==='damage'&&event.moveId==='resist-fire');
 assert.ok(first.amount<plain.amount);assert.equal(damage.breakdown.itemResistance.sourceId,'occa-berry');assert.equal(damage.breakdown.itemResistance.multiplier,.5);assert.equal(target.itemState.consumed,true);assert.equal(target.itemState.revealed,true);assert.deepEqual(first.events.filter(event=>event.kind.startsWith('item')).map(event=>event.kind),['itemRevealed','itemActivated','itemConsumed']);
 const restarted=JSON.parse(JSON.stringify(first.battle)),second=applyDamageHit(restarted,{actorId:'a1',targetId:'b1',move:attack,hit:2},maxRoll);assert.ok(!second.events.some(event=>event.itemId==='occa-berry'));assert.equal(second.events.find(event=>event.kind==='damage').breakdown.itemResistance,undefined);
});

test('Resistance berry family maps all seventeen super-effective types and rejects neutral or wrong-type hits',()=>{
 for(const [type,itemId] of Object.entries(resistanceBerryByType)){const effects=compilePassiveEffects({itemId,manifests});assert.ok(effects.some(effect=>effect.kind==='item-resist-hit'&&effect.type===type&&effect.requireSuperEffective===true&&effect.multiplier===.5));}
 let battle=fixture('single',{targetItem:'occa-berry',targetTypes:['normal']}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:{...move('neutral-fire',50),type:'fire'}},maxRoll);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);assert.ok(!result.events.some(event=>event.itemId==='occa-berry'));
 battle=fixture('single',{targetItem:'occa-berry',targetTypes:['grass']});result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:{...move('wrong-water',50),type:'water'}},maxRoll);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);assert.ok(!result.events.some(event=>event.itemId==='occa-berry'));
});

test('Chilan Berry halves the first damaging Normal-type hit without requiring super effectiveness',()=>{
 const attack={...move('chilan-normal',60),type:'normal'},plain=applyDamageHit(fixture('single'),{actorId:'a1',targetId:'b1',move:attack},maxRoll),result=applyDamageHit(fixture('single',{targetItem:'chilan-berry'}),{actorId:'a1',targetId:'b1',move:attack},maxRoll),target=result.battle.sides.B.roster[0];assert.ok(result.amount<plain.amount);assert.equal(target.itemState.consumed,true);assert.equal(result.events.find(event=>event.kind==='damage').breakdown.itemResistance.sourceId,'chilan-berry');
});

test('Magic Room suppresses resistance berries without consuming or revealing them',()=>{
 const field={rooms:{'magic-room':{id:'magic-room',remaining:3}}},battle=fixture('single',{targetItem:'occa-berry',targetTypes:['grass'],field}),result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:{...move('suppressed-fire',60),type:'fire'}},maxRoll),target=result.battle.sides.B.roster[0];assert.equal(target.itemState.consumed,false);assert.equal(target.itemState.revealed,false);assert.equal(result.events.find(event=>event.kind==='damage').breakdown.itemResistance,undefined);assert.ok(!result.events.some(event=>event.itemId==='occa-berry'));
});

test('remaining canonical type-boost items reuse the reviewed held-damage-boost contract',()=>{
 const expected={'black-glasses':'dark','hard-stone':'rock',magnet:'electric','never-melt-ice':'ice','poison-barb':'poison','silk-scarf':'normal','soft-sand':'ground','spell-tag':'ghost','twisted-spoon':'psychic'};
 for(const [itemId,type] of Object.entries(expected)){const effect=compilePassiveEffects({itemId,manifests}).find(effect=>effect.kind==='held-damage-boost');assert.equal(effect?.type,type);assert.equal(effect?.multiplier,1.2);}
});

test('Expert Belt boosts only super-effective damaging hits and Magic Room suppresses it',()=>{
 const attack={...move('expert-fire',60),type:'fire'},plain=applyDamageHit(fixture('single',{targetTypes:['grass']}),{actorId:'a1',targetId:'b1',move:attack},maxRoll);let battle=fixture('single',{targetTypes:['grass']}),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='expert-belt';actor.itemState=createHeldItemState('expert-belt');actor.passiveEffects=compilePassiveEffects({itemId:'expert-belt',manifests});let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack},maxRoll),damage=result.events.find(event=>event.kind==='damage');assert.ok(result.amount>plain.amount);assert.ok(damage.breakdown.passiveModifiers.some(effect=>effect.sourceId==='expert-belt'&&effect.multiplier===1.2));assert.equal(result.battle.sides.A.roster[0].itemState.revealed,false);
 battle=fixture('single',{targetTypes:['normal']});actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='expert-belt';actor.itemState=createHeldItemState('expert-belt');actor.passiveEffects=compilePassiveEffects({itemId:'expert-belt',manifests});result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack},maxRoll);assert.ok(!result.events.find(event=>event.kind==='damage').breakdown.passiveModifiers.some(effect=>effect.sourceId==='expert-belt'));
 battle.field.rooms={'magic-room':{id:'magic-room',remaining:2}};battle.sides.B.roster[0].types=['grass'];result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack},maxRoll);assert.ok(!result.events.find(event=>event.kind==='damage').breakdown.passiveModifiers.some(effect=>effect.sourceId==='expert-belt'));
});

test('Wide Lens applies a 1.1x accuracy modifier after battle stages without revealing the item',()=>{
 const battle=fixture('single'),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='wide-lens';actor.itemState=createHeldItemState('wide-lens');actor.passiveEffects=compilePassiveEffects({itemId:'wide-lens',manifests});assert.equal(accuracyWithHeldItems(80,actor,battle),88);assert.equal(accuracyWithHeldItems(95,actor,battle),100);assert.equal(actor.itemState.revealed,false);
 const payload={action:{kind:'move',side:'A',actorId:'a1',target:{side:'B',slot:0}},move:{...move('wide-lens-check'),accuracy:80},mechanics:{targetMode:'adjacentFoe',redirectable:true}},hit=checkAccuracyHandler.run({battle,payload,params:{},runtime:{nextRandom:()=>.85}});assert.deepEqual(hit.payload.hitTargetIds,['b1']);
 const suppressed=structuredClone(battle);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:2}};const miss=checkAccuracyHandler.run({battle:suppressed,payload,params:{},runtime:{nextRandom:()=>.85}});assert.deepEqual(miss.payload.hitTargetIds,[]);assert.equal(miss.events.find(event=>event.kind==='moveMissed').effectiveAccuracy,80);
});

test('Oran Berry reuses HP-threshold consumption but restores a fixed 10 HP',()=>{
 const battle=fixture('single',{targetItem:'oran-berry',targetHp:70}),attack={...move('oran-hit',20),type:'normal'},result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack},maxRoll),damage=result.events.find(event=>event.kind==='damage'&&event.moveId==='oran-hit'),heal=result.events.find(event=>event.kind==='heal'&&event.source==='oran-berry'),target=result.battle.sides.B.roster[0];assert.ok(damage);assert.equal(heal?.amount,10);assert.equal(target.itemState.consumed,true);assert.equal(target.itemState.activationCount,1);
});


test('Bright Powder lowers incoming move accuracy by 10 percent without revealing and Magic Room suppresses it',()=>{
 const battle=fixture('single',{targetItem:'bright-powder'}),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];
 assert.equal(accuracyWithHeldItems(100,actor,battle,{target}),90);assert.equal(target.itemState.revealed,false);
 const payload={action:{actorId:'a1',side:'A',target:{side:'B',slot:0}},move:move('bright-powder-check'),mechanics:{targetMode:'adjacentFoe',redirectable:true}},miss=checkAccuracyHandler.run({battle,payload,params:{},runtime:{nextRandom:()=>.95}});assert.equal(miss.payload.hitTargetIds.length,0);assert.ok(miss.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===90));
 const suppressed=structuredClone(battle);suppressed.field.rooms={'magic-room':{id:'magic-room',remaining:3}};const hit=checkAccuracyHandler.run({battle:suppressed,payload,params:{},runtime:{nextRandom:()=>.95}});assert.deepEqual(hit.payload.hitTargetIds,['b1']);assert.equal(hit.battle.sides.B.roster[0].itemState.revealed,false);
});

test('Scope Lens raises critical ratio by one stage while remaining hidden and Magic Room removes the stage',()=>{
 let battle=fixture(),actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='scope-lens';actor.itemState=createHeldItemState('scope-lens');actor.passiveEffects=compilePassiveEffects({itemId:'scope-lens',manifests});
 assert.equal(criticalChanceWithHeldItems(actor,battle),1/8);assert.equal(actor.itemState.revealed,false);
 const rolls=[.1,.999],critical=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('scope-lens-hit',60)},{nextRandom:()=>rolls.shift()}),damage=critical.events.find(event=>event.kind==='damage');assert.equal(damage.breakdown.critical,1.5);assert.equal(critical.battle.sides.A.roster[0].itemState.revealed,false);
 battle=fixture();actor=battle.sides.A.roster[0];actor.buildSnapshot.itemId='scope-lens';actor.itemState=createHeldItemState('scope-lens');actor.passiveEffects=compilePassiveEffects({itemId:'scope-lens',manifests});battle.field.rooms={'magic-room':{id:'magic-room',remaining:3}};assert.equal(criticalChanceWithHeldItems(actor,battle),1/24);const suppressedRolls=[.1,.999],normal=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('scope-lens-suppressed',60)},{nextRandom:()=>suppressedRolls.shift()});assert.equal(normal.events.find(event=>event.kind==='damage').breakdown.critical,1);
});

test('Focus Band uses a seeded 10 percent lethal-hit roll, is not consumed, and can activate repeatedly',()=>{
 let battle=fixture('single',{targetItem:'focus-band'}),rolls=[.999,.999,.05],first=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('focus-band-lethal',220),hit:1},{nextRandom:()=>rolls.shift()}),target=first.battle.sides.B.roster[0];assert.equal(target.hp,1);assert.equal(target.itemState.revealed,true);assert.equal(target.itemState.consumed,false);assert.equal(target.itemState.activationCount,1);assert.ok(!first.events.some(event=>event.kind==='itemConsumed'));
 rolls=[.999,.999,.05];const second=applyDamageHit(JSON.parse(JSON.stringify(first.battle)),{actorId:'a1',targetId:'b1',move:move('focus-band-lethal',220),hit:2},{nextRandom:()=>rolls.shift()}),again=second.battle.sides.B.roster[0];assert.equal(again.hp,1);assert.equal(again.itemState.activationCount,2);assert.equal(again.itemState.consumed,false);
 battle=fixture('single',{targetItem:'focus-band'});rolls=[.999,.999,.5];const failed=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('focus-band-fail',220)},{nextRandom:()=>rolls.shift()}),fainted=failed.battle.sides.B.roster[0];assert.equal(fainted.hp,0);assert.equal(fainted.itemState.revealed,false);assert.equal(fainted.itemState.activationCount,0);
});

test('Focus Band also rolls on lethal fixed move damage without consuming itself',()=>{
 const battle=fixture('single',{targetItem:'focus-band'});battle.level=200;const fixedMove={id:'focus-band-fixed',type:'normal',category:'physical'},mechanics={targetMode:'adjacentFoe',redirectable:true},payload={action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:fixedMove,mechanics},result=fixedDamageHandler.run({battle,payload,params:{formula:'user-level'},runtime:{nextRandom:()=>.05}}),target=result.battle.sides.B.roster[0];assert.equal(target.hp,1);assert.equal(target.itemState.consumed,false);assert.equal(target.itemState.revealed,true);assert.equal(result.events.find(event=>event.kind==='damage').breakdown.itemSurvival.sourceId,'focus-band');
});
