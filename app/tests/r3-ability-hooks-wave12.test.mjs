import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 HANDLER_DEFINITIONS,applyDamageHit,applyResistanceBerryToMoveDamage,applyStatStagesHandler,checkAccuracyHandler,compilePassiveEffects,createHeldItemState,
 createHookRegistry,createMoveActionHandler,resolveContactAbilityResponses,resolveEntryAbilities,resolveHpThresholdItems,resolvePpRestoreItems,resolveTargetAbilityBlock,validateMechanicManifest
} from '../mechanics-v3/index.mjs';
import {resolveTargets} from '../mechanics-v3/targets.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const ids=['contrary','damp','lightning-rod','opportunist','ripen','unaware'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:300,maxHp:300,stats:{hp:300,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16,explosion:5},maxPp:{hit:16,explosion:5},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave12-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const move=(id='hit',type='normal',category='physical',power=80,accuracy=100)=>({id,name:id,type,category,power,accuracy,maxPP:16,contact:false});
const mechanics=(overrides={})=>({targetMode:'adjacentFoe',redirectable:true,priority:0,contact:false,tags:[],handlers:[],...overrides});

for(const format of ['single','double'])test(`r3-ability-hooks-wave12:${format} compiles and validates all promoted abilities`,()=>{
 for(const id of ids){assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceId===id&&effect.sourceKind==='ability'),id);}
});

test('Contrary reverses primary, entry, and contact Ability stat changes before downstream response logic',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('contrary');let result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'A',slot:0}},move:move('boost','normal','status',0),mechanics:mechanics({targetMode:'self'})},params:{boosts:{atk:2},target:'self'}});assert.equal(result.battle.sides.A.roster[0].stages.atk,-2);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='contrary'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('intimidate');battle.sides.B.roster[0].passiveEffects=effects('contrary');result=resolveEntryAbilities(battle,[{kind:'switchIn',side:'A',actorId:'a1'}]);assert.equal(result.battle.sides.B.roster[0].stages.atk,1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('contrary');battle.sides.B.roster[0].passiveEffects=effects('gooey');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({contact:true}),damage:20},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].stages.spe,1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('contrary');battle.sides.B.roster[0].passiveEffects=effects('mirror-armor');result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('drop','normal','status',0),mechanics:mechanics()},params:{boosts:{atk:-1},target:'target'}});assert.equal(result.battle.sides.A.roster[0].stages.atk,1);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='contrary'));
});

test('Damp blocks explosive move execution after PP spend and also suppresses Aftermath damage',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('damp');
 const registry=createHookRegistry(HANDLER_DEFINITIONS),catalogMoves={explosion:move('explosion','normal','physical',250)},catalogManifests={explosion:{id:'explosion',targetMode:'adjacentFoe',redirectable:true,priority:0,contact:false,handlers:[{id:'spend-pp',hook:'onTryMove',order:10},{id:'deal-direct-damage',hook:'onMove',order:100}],testEvidence:{single:['wave12'],double:['wave12']}}},resolve=createMoveActionHandler({moves:catalogMoves,manifests:catalogManifests,registry});
 let result=resolve(battle,{kind:'move',side:'A',actorId:'a1',moveId:'explosion',target:{side:'B',slot:0},priority:0,speed:100},{nextRandom:()=>0.9});assert.equal(result.battle.sides.A.roster[0].pp.explosion,4);assert.equal(result.battle.sides.B.roster[0].hp,300);assert.ok(result.events.some(e=>e.kind==='moveBlocked'&&e.abilityId==='damp'));
 battle=fixture('double');battle.sides.B.roster[0].passiveEffects=effects('aftermath');battle.sides.B.roster[0].hp=0;battle.sides.B.roster[1].passiveEffects=effects('damp');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({contact:true}),damage:300},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,300);assert.ok(result.events.some(e=>e.kind==='abilityResponseBlocked'&&e.blockingAbilityId==='damp'));
});

test('Lightning Rod redirects Electric moves by effective Speed across both sides, blocks the hit, and raises Special Attack',()=>{
 let battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('lightning-rod');const shock=move('shock','electric','special',80);let targets=resolveTargets(battle,{side:'A',actorId:'a1',targetMode:'adjacentFoe',target:{side:'B',slot:0}},{redirectable:true,move:shock});assert.deepEqual(targets.map(t=>t.actorId),['b2']);let blocked=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'b2',move:shock,mechanics:mechanics()});assert.equal(blocked.blocked,true);assert.equal(blocked.battle.sides.B.roster[1].stages.spa,1);assert.ok(blocked.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='lightning-rod'));
 battle=fixture('double');battle.sides.A.roster[1].stats.spe=160;battle.sides.A.roster[1].passiveEffects=effects('lightning-rod');battle.sides.B.roster[1].stats.spe=80;battle.sides.B.roster[1].passiveEffects=effects('lightning-rod');targets=resolveTargets(battle,{side:'A',actorId:'a1',targetMode:'adjacentFoe',target:{side:'B',slot:0}},{redirectable:true,move:shock});assert.deepEqual(targets.map(t=>t.actorId),['a2']);blocked=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'a2',move:shock,mechanics:mechanics()});assert.equal(blocked.blocked,true);assert.equal(blocked.battle.sides.A.roster[1].stages.spa,1);
});

test('Opportunist copies only applied positive opposing stat gains and does not mirror drops',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('opportunist');let result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'A',slot:0}},move:move('boost','normal','status',0),mechanics:mechanics({targetMode:'self'})},params:{boosts:{atk:2,def:1},target:'self'}});assert.equal(result.battle.sides.B.roster[0].stages.atk,2);assert.equal(result.battle.sides.B.roster[0].stages.def,1);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='opportunist'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('opportunist');result=applyStatStagesHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'A',slot:0}},move:move('drop','normal','status',0),mechanics:mechanics({targetMode:'self'})},params:{boosts:{atk:-1},target:'self'}});assert.equal(result.battle.sides.B.roster[0].stages.atk,0);
});

test('Ripen doubles supported Berry healing and doubles resistance effect magnitude',()=>{
 let battle=fixture();let holder=battle.sides.A.roster[0];holder.hp=100;holder.itemState=createHeldItemState('sitrus-berry');holder.passiveEffects=[...effects('ripen'),...effects(null,'sitrus-berry')];let result=resolveHpThresholdItems(battle,{actorIds:['a1'],trigger:'wave12'});assert.equal(result.battle.sides.A.roster[0].hp,250);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);
 battle=fixture();holder=battle.sides.B.roster[0];holder.itemState=createHeldItemState('occa-berry');holder.passiveEffects=[...effects('ripen'),...effects(null,'occa-berry')];result=applyResistanceBerryToMoveDamage(battle,{targetId:'b1',moveType:'fire',effectiveness:2,moveId:'flame'});assert.equal(result.multiplier,0.25);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,true);
 battle=fixture();holder=battle.sides.A.roster[0];holder.pp.hit=0;holder.maxPp.hit=30;holder.itemState=createHeldItemState('leppa-berry');holder.passiveEffects=[...effects('ripen'),...effects(null,'leppa-berry')];result=resolvePpRestoreItems(battle,{actorIds:['a1'],trigger:'wave12'});assert.equal(result.battle.sides.A.roster[0].pp.hit,20);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);assert.ok(result.events.some(e=>e.kind==='ppRestored'&&e.amount===20&&e.abilityMultiplier===2));
});

test('side-condition-bypass foundation remains compatible after Infiltrator promotion',()=>{
 const attack=move('hit','normal','physical',80),roll=()=>{let rolls=[0.9,0.5];return ()=>rolls.shift()??0.5;};let battle=fixture();battle.sides.B.conditions.reflect={id:'reflect',sourceId:'b1',endTurnTimer:5};const screened=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack,mechanics:mechanics()},{nextRandom:roll()});
 battle=fixture();battle.sides.B.conditions.reflect={id:'reflect',sourceId:'b1',endTurnTimer:5};battle.sides.A.roster[0].passiveEffects=effects('infiltrator');const bypassed=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack,mechanics:mechanics()},{nextRandom:roll()});assert.ok(bypassed.amount>screened.amount);assert.ok(manifests.abilities.infiltrator);assert.deepEqual(manifests.abilities.infiltrator.handlers[0].params.conditions,['reflect','light-screen','safeguard','substitute']);
});

test('Unaware ignores the relevant opposing combat stages and accuracy/evasion stages',()=>{
 let battle=fixture();battle.sides.A.roster[0].stages.atk=6;battle.sides.B.roster[0].passiveEffects=effects('unaware');const attack=move('hit','normal','physical',80);const rng=(()=>{let rolls=[0.9,0.5];return ()=>rolls.shift()??0.5;})();const unaware=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack,mechanics:mechanics()}, {nextRandom:rng});battle=fixture();battle.sides.A.roster[0].stages.atk=6;const boosted=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:attack,mechanics:mechanics()},{nextRandom:(()=>{let rolls=[0.9,0.5];return ()=>rolls.shift()??0.5;})()});assert.ok(boosted.amount>unaware.amount*2);
 battle=fixture();battle.sides.A.roster[0].stages.accuracy=6;battle.sides.B.roster[0].passiveEffects=effects('unaware');const checked=checkAccuracyHandler.run({battle,payload:{action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:move('test','normal','status',0,60),mechanics:mechanics()},params:{},runtime:{nextRandom:()=>0.7}});assert.deepEqual(checked.payload.hitTargetIds,[]);
});
