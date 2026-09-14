import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {activateHeldItem,applyDamageHit,applyMajorStatus,applyVolatileStatus,compilePassiveEffects,createHeldItemState,resolveAfterMoveItems,resolveEntryHazards,resolveMechanicsEndTurn,resolveProtectionBlock,tryConfusionAction} from '../mechanics-v3/index.mjs';
import {applyRecoilHandler} from '../mechanics-v3/handlers/apply-recoil.mjs';
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
