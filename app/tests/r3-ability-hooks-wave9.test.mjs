import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applyMajorStatus,applyStatStagesHandler,checkAccuracyHandler,compilePassiveEffects,createHeldItemState,resolveMechanicsEndTurn
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=abilityId=>compilePassiveEffects({abilityId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},maxPp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave9-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:37,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const ids=['armor-tail','queenly-majesty','sweet-veil','corrosion','tangled-feet','dry-skin','flower-veil'];
const move=(id='hit',type='normal',category='physical',power=60,accuracy=100)=>({id,name:id,type,category,power,accuracy,maxPP:16,contact:false});
const mechanics=(priority=0,targetMode='adjacentFoe')=>({targetMode,redirectable:true,priority,contact:false,tags:[],handlers:[]});
function accuracy(battle,{actorId='a1',targetSide='B',targetSlot=0,usedMove=move(),usedMechanics=mechanics(),roll=.5}={}){
 return checkAccuracyHandler.run({battle,payload:{action:{kind:'move',side:actorId.startsWith('a')?'A':'B',actorId,target:{side:targetSide,slot:targetSlot}},move:usedMove,mechanics:usedMechanics},params:{},runtime:{nextRandom:()=>roll}});
}
function statPayload(actorId='a1',targetSide='B',targetSlot=0){
 return {action:{kind:'move',side:actorId.startsWith('a')?'A':'B',actorId,target:{side:targetSide,slot:targetSlot}},move:move('growl','normal','status',0),mechanics:mechanics(0),accuracyResolved:true,resolvedTargetIds:[targetSide==='B'?'b1':'a1'],hitTargetIds:[targetSide==='B'?'b1':'a1']};
}

for(const format of ['single','double'])test(`r3-ability-hooks-wave9:${format} compiles candidate-backed side-aura and conditional abilities`,()=>{
 for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(fixture(format).format,format);
});

test('Armor Tail and Queenly Majesty protect the active side from opposing priority without blocking normal priority',()=>{
 for(const id of ['armor-tail','queenly-majesty']){
  let battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects(id);
  let result=accuracy(battle,{usedMove:move('baby-doll-eyes','fairy','status',0),usedMechanics:mechanics(1),roll:0});
  assert.deepEqual(result.payload.hitTargetIds,[],id);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.abilityId===id&&event.sourceId==='b2'),id);
  result=accuracy(battle,{usedMove:move('growl','normal','status',0),usedMechanics:mechanics(0),roll:.99});assert.deepEqual(result.payload.hitTargetIds,['b1'],id);
 }
});

test('Sweet Veil blocks sleep for holder and ally but leaves unrelated major statuses alone',()=>{
 let battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('sweet-veil');
 let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'sleep-powder',status:'sleep'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(event=>event.reason==='abilityBlocked'&&event.sourceAbilityId==='sweet-veil'));
 result=applyMajorStatus(result.battle,{actorId:'a1',targetId:'b2',moveId:'hypnosis',status:'sleep'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[1].status,null);
 result=applyMajorStatus(result.battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status.id,'burn');
});

test('Corrosion bypasses only Poison and Steel type immunity for poison statuses',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('corrosion');battle.sides.B.roster[0].types=['steel'];
 let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'toxic',status:'bad-poison',blockedTargetTypes:['poison','steel']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status.id,'bad-poison');
 battle=fixture();battle.sides.B.roster[0].types=['steel'];result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'toxic',status:'bad-poison',blockedTargetTypes:['poison','steel']},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events[0].reason,'typeImmune');
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('corrosion');battle.sides.B.roster[0].types=['fire'];result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events[0].reason,'typeImmune');
});

test('Tangled Feet halves incoming accuracy only while the holder is confused',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('tangled-feet');battle.sides.B.roster[0].volatiles.confusion={id:'confusion',turnsRemaining:2};
 let result=accuracy(battle,{usedMove:move('sure-ish','normal','physical',60,100),roll:.6});assert.deepEqual(result.payload.hitTargetIds,[]);assert.equal(result.events.find(event=>event.kind==='moveMissed').effectiveAccuracy,50);
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('tangled-feet');result=accuracy(battle,{usedMove:move('sure-ish','normal','physical',60,100),roll:.6});assert.deepEqual(result.payload.hitTargetIds,['b1']);
});

test('Dry Skin absorbs Water, amplifies Fire, heals in rain, and loses HP in sun',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('dry-skin');battle.sides.B.roster[0].hp=200;
 let result=accuracy(battle,{usedMove:move('surf','water','special',80),roll:.99});assert.deepEqual(result.payload.hitTargetIds,[]);assert.equal(result.battle.sides.B.roster[0].hp,280);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='dry-skin'));
 const base=fixture(),dry=fixture();dry.sides.B.roster[0].passiveEffects=effects('dry-skin');const runtime=()=>{const rolls=[.99,.5];return {nextRandom:()=>rolls.shift()??.5};};
 const baseHit=applyDamageHit(base,{actorId:'a1',targetId:'b1',move:move('flamethrower','fire','special',80),mechanics:{tags:[],contact:false}},runtime());const dryHit=applyDamageHit(dry,{actorId:'a1',targetId:'b1',move:move('flamethrower','fire','special',80),mechanics:{tags:[],contact:false}},runtime());assert.ok(dryHit.amount>baseHit.amount);assert.ok(dryHit.events.find(event=>event.kind==='damage').breakdown.passiveModifiers.some(entry=>entry.sourceId==='dry-skin'&&entry.multiplier===1.25));
 battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'rain',remaining:2};battle.sides.B.roster[0].passiveEffects=effects('dry-skin');battle.sides.B.roster[0].hp=200;result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.B.roster[0].hp,240);
 battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'sun',remaining:2};battle.sides.B.roster[0].passiveEffects=effects('dry-skin');battle.sides.B.roster[0].hp=200;result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.B.roster[0].hp,160);
});

test('Flower Veil protects Grass allies from external status and stat drops but not self-inflicted effects',()=>{
 let battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('flower-veil');battle.sides.B.roster[0].types=['grass'];
 let result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(event=>event.sourceAbilityId==='flower-veil'));
 result=applyStatStagesHandler.run({battle:result.battle,payload:statPayload(),params:{boosts:{atk:-1,spe:-1}}});assert.equal(result.battle.sides.B.roster[0].stages.atk,0);assert.equal(result.battle.sides.B.roster[0].stages.spe,0);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.sourceAbilityId==='flower-veil'));
 battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('flower-veil');battle.sides.B.roster[0].types=['normal'];result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status.id,'burn');
 battle=fixture();battle.sides.A.roster[0].types=['grass'];battle.sides.A.roster[0].passiveEffects=effects('flower-veil');const selfPayload={action:{kind:'move',side:'A',actorId:'a1',target:{side:'A',slot:0}},move:move('leaf-storm','grass','special',130),mechanics:mechanics(0,'self'),accuracyResolved:false,resolvedTargetIds:[],hitTargetIds:[]};result=applyStatStagesHandler.run({battle,payload:selfPayload,params:{target:'self',boosts:{spa:-2}}});assert.equal(result.battle.sides.A.roster[0].stages.spa,-2);result=applyMajorStatus(result.battle,{actorId:'a1',targetId:'a1',moveId:'self-status',status:'poison'},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].status.id,'poison');
});
