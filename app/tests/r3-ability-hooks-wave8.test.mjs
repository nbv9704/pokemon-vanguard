import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applyMajorStatus,applyStatStagesHandler,applyVolatileStatus,compilePassiveEffects,createHeldItemState,
 resolveEntryAbilities,resolveFlinchItems,resolveMechanicsEndTurn,tryFlinchAction
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId=null,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},maxPp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave8-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:31,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const ids=['competitive','defiant','inner-focus','own-tempo','merciless','poison-heal','synchronize','steadfast'];
const move=(id='hit',type='normal',category='physical',power=40)=>({id,name:id,type,category,power,accuracy:100,maxPP:16,contact:false});
const statPayload=(targetMode='adjacentFoe')=>({action:{kind:'move',side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('growl','normal','status',0),mechanics:{targetMode,redirectable:true},accuracyResolved:true,resolvedTargetIds:['b1'],hitTargetIds:['b1']});

for(const format of ['single','double'])test(`r3-ability-hooks-wave8:${format} compiles candidate-backed response abilities`,()=>{
 for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(fixture(format).format,format);
});

test('Defiant and Competitive react once to opponent stat drops but not self or ally drops',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('defiant');let result=applyStatStagesHandler.run({battle,payload:statPayload(),params:{boosts:{def:-1,spd:-1}}});assert.equal(result.battle.sides.B.roster[0].stages.atk,2);assert.equal(result.events.filter(event=>event.kind==='abilityTriggered'&&event.abilityId==='defiant').length,1);
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('competitive');result=applyStatStagesHandler.run({battle,payload:statPayload(),params:{boosts:{atk:-1}}});assert.equal(result.battle.sides.B.roster[0].stages.spa,2);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('defiant');const selfPayload={...statPayload('self'),action:{kind:'move',side:'A',actorId:'a1',target:{side:'A',slot:0}},accuracyResolved:false,resolvedTargetIds:[],hitTargetIds:[]};result=applyStatStagesHandler.run({battle,payload:selfPayload,params:{target:'self',boosts:{def:-1}}});assert.equal(result.battle.sides.A.roster[0].stages.atk,0);
});

test('Intimidate triggers Defiant while Inner Focus and Own Tempo block Intimidate only',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('intimidate');battle.sides.B.roster[0].passiveEffects=effects('defiant');let result=resolveEntryAbilities(battle,[{kind:'switchIn',actorId:'a1',side:'A',slot:0}]);assert.equal(result.battle.sides.B.roster[0].stages.atk,1);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='defiant'));
 for(const id of ['inner-focus','own-tempo']){battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('intimidate');battle.sides.B.roster[0].passiveEffects=effects(id);result=resolveEntryAbilities(battle,[{kind:'switchIn',actorId:'a1',side:'A',slot:0}]);assert.equal(result.battle.sides.B.roster[0].stages.atk,0,id);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.sourceAbilityId===id),id);result=applyStatStagesHandler.run({battle:result.battle,payload:statPayload(),params:{boosts:{atk:-1}}});assert.equal(result.battle.sides.B.roster[0].stages.atk,-1,id);}
});

test('Inner Focus and Own Tempo block their volatile statuses before RNG/item application',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('inner-focus');let result=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'fake-out',volatile:'flinch'},{nextRandom:()=>.5});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.equal(result.events[0].sourceAbilityId,'inner-focus');
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('own-tempo');result=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'confuse-ray',volatile:'confusion'},{nextRandom:()=>.5});assert.equal(result.battle.sides.B.roster[0].volatiles.confusion,undefined);assert.equal(result.events[0].sourceAbilityId,'own-tempo');
 battle=fixture();battle.sides.A.roster[0].itemState=createHeldItemState('kings-rock');battle.sides.A.roster[0].passiveEffects=effects(null,'kings-rock');battle.sides.B.roster[0].passiveEffects=effects('inner-focus');result=resolveFlinchItems(battle,{actorId:'a1',move:move(),mechanics:{secondaryEffects:[]},damagedTargetIds:['b1']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.ok(result.events.some(event=>event.sourceAbilityId==='inner-focus'));
});

test('Steadfast raises Speed only when flinch actually prevents the action',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('steadfast');battle=applyVolatileStatus(battle,{actorId:'a1',targetId:'b1',moveId:'fake-out',volatile:'flinch'},{nextRandom:()=>.5}).battle;const result=tryFlinchAction(battle,{actorId:'b1'});assert.equal(result.cancelled,true);assert.equal(result.battle.sides.B.roster[0].stages.spe,1);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='steadfast'));const again=tryFlinchAction(result.battle,{actorId:'b1'});assert.equal(again.cancelled,false);assert.equal(again.battle.sides.B.roster[0].stages.spe,1);
});

test('Merciless forces critical hits against poisoned targets but critical immunity still wins',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('merciless');battle.sides.B.roster[0].status={id:'poison',sourceId:'toxic',turnsActive:0};let rolls=[.99,.99];let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move(),mechanics:{tags:[],contact:false}},{nextRandom:()=>rolls.shift()??.99});assert.equal(result.events.find(event=>event.kind==='damage').breakdown.critical,1.5);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('merciless');battle.sides.B.roster[0].passiveEffects=effects('shell-armor');battle.sides.B.roster[0].status={id:'bad-poison',sourceId:'toxic',turnsActive:0,toxicCounter:0};rolls=[0,.99];result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move(),mechanics:{tags:[],contact:false}},{nextRandom:()=>rolls.shift()??.99});assert.equal(result.events.find(event=>event.kind==='damage').breakdown.critical,1);
});

test('Poison Heal restores one eighth and freezes toxic escalation while poisoned',()=>{
 for(const status of ['poison','bad-poison']){let battle=fixture();const holder=battle.sides.B.roster[0];holder.hp=200;holder.passiveEffects=effects('poison-heal');holder.status=status==='bad-poison'?{id:status,sourceId:'toxic',turnsActive:0,toxicCounter:3}:{id:status,sourceId:'toxic',turnsActive:0};battle.phase='END_TURN';const result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.B.roster[0].hp,240,status);if(status==='bad-poison')assert.equal(result.battle.sides.B.roster[0].status.toxicCounter,3);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='poison-heal'));}
});

test('Synchronize reflects supported major status once and respects immunity on the source',()=>{
 for(const status of ['burn','paralysis','poison','bad-poison']){let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('synchronize');const result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'status-test',status},{nextRandom:()=>.5});assert.equal(result.battle.sides.B.roster[0].status.id,status);assert.equal(result.battle.sides.A.roster[0].status.id,status);assert.equal(result.events.filter(event=>event.kind==='abilityTriggered'&&event.abilityId==='synchronize').length,1,status);}
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('synchronize');let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'sleep-test',status:'sleep'},{nextRandom:()=>.5});assert.equal(result.battle.sides.A.roster[0].status,null);battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('synchronize');battle.sides.A.roster[0].types=['fire'];result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'burn-test',status:'burn'},{nextRandom:()=>.5});assert.equal(result.battle.sides.B.roster[0].status.id,'burn');assert.equal(result.battle.sides.A.roster[0].status,null);assert.ok(result.events.some(event=>event.kind==='statusFailed'&&event.reflected===true&&event.reason==='typeImmune'));
});
