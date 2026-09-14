import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyMechanicsSwitch,applyPivotSwitch,compilePassiveEffects,createHeldItemState,resolveEntryAbilities,resolveEntryHazards,resolveMechanicsEndTurn
} from '../mechanics-v3/index.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,{abilityId=null,itemId=null,hp=300,maxHp=300,spe=100,...overrides}={})=>({actorId,types:['normal'],hp,maxHp,stats:{hp:maxHp,atk:100,def:100,spa:100,spd:100,spe},pp:{tackle:35},maxPp:{tackle:35},status:null,volatiles:{},stages:stages(),buildSnapshot:{itemId,abilityId,moveIds:['tackle']},activeAbilityId:abilityId,itemState:createHeldItemState(itemId),passiveEffects:effects(abilityId,itemId),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1;
 const a=[unit('a1'),unit('a2'),unit('a3')],b=[unit('b1'),unit('b2'),unit('b3')];
 return {id:`ability-lifecycle-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:0,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const switchIn=(actorId,side,slot=0)=>({kind:'switchIn',actorId,side,slot});

for(const format of ['single','double'])test(`r3-ability-hooks-wave5:${format} compiles lifecycle abilities from the candidate-backed manifest`,()=>{
 const ids=['natural-cure','regenerator','shed-skin','drizzle','drought','sand-stream','snow-warning','intimidate','supersweet-syrup','screen-cleaner','curious-medicine','hospitality'];
 for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(fixture(format).format,format);
});

test('Natural Cure and Regenerator resolve before the shared switch reset and survive manual/pivot routing',()=>{
 let battle=fixture();let outgoing=battle.sides.A.roster[0];outgoing.activeAbilityId='natural-cure';outgoing.passiveEffects=effects('natural-cure');outgoing.status={id:'bad-poison',toxicCounter:4};outgoing.stages.atk=2;outgoing.volatiles.confusion={id:'confusion'};
 let result=applyMechanicsSwitch(battle,'A','a1','a3');assert.equal(result.ok,true);outgoing=result.battle.sides.A.roster[0];assert.equal(outgoing.status,null);assert.deepEqual(outgoing.stages,stages());assert.deepEqual(outgoing.volatiles,{});assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.abilityId==='natural-cure'));
 battle=fixture();outgoing=battle.sides.A.roster[0];outgoing.activeAbilityId='regenerator';outgoing.passiveEffects=effects('regenerator');outgoing.hp=120;
 result=applyPivotSwitch(battle,{side:'A',actorId:'a1',toId:'a3',moveId:'u-turn',totalDamage:20});assert.equal(result.succeeded,true);assert.equal(result.battle.sides.A.roster[0].hp,220);assert.ok(result.events.some(event=>event.kind==='heal'&&event.abilityId==='regenerator'&&event.amount===100));
});

test('Shed Skin consumes battle RNG deterministically and cures before major-status residual damage',()=>{
 let battle=fixture();battle.phase='END_TURN';battle.rngState=0;const actor=battle.sides.A.roster[0];actor.activeAbilityId='shed-skin';actor.passiveEffects=effects('shed-skin');actor.status={id:'poison'};const expected=nextRandom(0);
 const result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.A.roster[0].status,null);assert.equal(result.battle.sides.A.roster[0].hp,300);assert.equal(result.battle.rngState,expected.rngState);assert.ok(result.events.some(event=>event.kind==='statusCured'&&event.abilityId==='shed-skin'));
 battle=fixture();battle.phase='END_TURN';battle.rngState=1000;const second=battle.sides.A.roster[0];second.activeAbilityId='shed-skin';second.passiveEffects=effects('shed-skin');second.status={id:'poison'};const roll=nextRandom(1000);assert.ok(roll.value>=1/3);const failed=resolveMechanicsEndTurn(battle);assert.notEqual(failed.battle.sides.A.roster[0].status,null);assert.ok(failed.battle.sides.A.roster[0].hp<300);assert.equal(failed.battle.rngState,roll.rngState);
});

test('entry weather abilities share the weather engine, honor weather rocks, and resolve slower entrants last',()=>{
 let battle=fixture('double');const rain=battle.sides.A.roster[0],sun=battle.sides.B.roster[0];rain.activeAbilityId='drizzle';rain.passiveEffects=effects('drizzle','damp-rock');rain.itemState=createHeldItemState('damp-rock');rain.buildSnapshot.itemId='damp-rock';rain.stats.spe=140;sun.activeAbilityId='drought';sun.passiveEffects=effects('drought');sun.stats.spe=80;
 let result=resolveEntryAbilities(battle,[switchIn('a1','A',0),switchIn('b1','B',0)]);assert.equal(result.battle.field.weather.id,'sun');assert.equal(result.battle.field.weather.remaining,5);assert.deepEqual(result.events.filter(event=>event.kind==='weatherStarted').map(event=>event.weather),['rain','sun']);assert.equal(result.events.find(event=>event.kind==='weatherStarted'&&event.weather==='rain').remaining,8);
 battle=fixture();const snow=battle.sides.A.roster[0];snow.activeAbilityId='snow-warning';snow.passiveEffects=effects('snow-warning');result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.field.weather.id,'snow');
 battle=fixture();const sand=battle.sides.A.roster[0];sand.activeAbilityId='sand-stream';sand.passiveEffects=effects('sand-stream');result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.field.weather.id,'sandstorm');
});

test('Intimidate hits both opposing slots, respects stat-drop immunity, and lets White Herb recover the other target',()=>{
 const battle=fixture('double'),actor=battle.sides.A.roster[0],immune=battle.sides.B.roster[0],herb=battle.sides.B.roster[1];actor.activeAbilityId='intimidate';actor.passiveEffects=effects('intimidate');immune.activeAbilityId='clear-body';immune.passiveEffects=effects('clear-body');herb.buildSnapshot.itemId='white-herb';herb.itemState=createHeldItemState('white-herb');herb.passiveEffects=effects(null,'white-herb');
 const result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.sides.B.roster[0].stages.atk,0);assert.equal(result.battle.sides.B.roster[1].stages.atk,0);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.targetId==='b1'&&event.sourceAbilityId==='clear-body'));assert.ok(result.events.some(event=>event.kind==='itemConsumed'&&event.sourceId==='b2'&&event.itemId==='white-herb'));
});

test('Supersweet Syrup lowers opposing evasion only on its first entry for the battle',()=>{
 let battle=fixture(),actor=battle.sides.A.roster[0];actor.activeAbilityId='supersweet-syrup';actor.passiveEffects=effects('supersweet-syrup');let first=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(first.battle.sides.B.roster[0].stages.evasion,-1);
 let switched=applyMechanicsSwitch(first.battle,'A','a1','a3');assert.equal(switched.ok,true);switched=applyMechanicsSwitch(switched.battle,'A','a3','a1');assert.equal(switched.ok,true);const second=resolveEntryAbilities(switched.battle,[switchIn('a1','A')]);assert.equal(second.battle.sides.B.roster[0].stages.evasion,-1);assert.equal(second.events.some(event=>event.abilityId==='supersweet-syrup'),false);
});

test('Screen Cleaner clears both sides while Curious Medicine and Hospitality affect only active allies',()=>{
 let battle=fixture('double');battle.sides.A.conditions.reflect={id:'reflect',remaining:3};battle.sides.B.conditions['light-screen']={id:'light-screen',remaining:3};const cleaner=battle.sides.A.roster[0];cleaner.activeAbilityId='screen-cleaner';cleaner.passiveEffects=effects('screen-cleaner');let result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.sides.A.conditions.reflect,undefined);assert.equal(result.battle.sides.B.conditions['light-screen'],undefined);assert.equal(result.events.filter(event=>event.kind==='sideConditionEnded').length,2);
 battle=fixture('double');const medicine=battle.sides.A.roster[0],ally=battle.sides.A.roster[1];medicine.activeAbilityId='curious-medicine';medicine.passiveEffects=effects('curious-medicine');medicine.stages.spa=2;ally.stages.atk=3;ally.stages.def=-2;result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.sides.A.roster[0].stages.spa,2);assert.equal(result.battle.sides.A.roster[1].stages.atk,0);assert.equal(result.battle.sides.A.roster[1].stages.def,0);
 battle=fixture('double');const host=battle.sides.A.roster[0],guest=battle.sides.A.roster[1];host.activeAbilityId='hospitality';host.passiveEffects=effects('hospitality');guest.hp=100;result=resolveEntryAbilities(battle,[switchIn('a1','A')]);assert.equal(result.battle.sides.A.roster[1].hp,175);assert.ok(result.events.some(event=>event.kind==='heal'&&event.targetId==='a2'&&event.abilityId==='hospitality'));
});

test('entry Ability resolution is wired before hazards so weather and stage changes survive entry damage',()=>{
 const battle=fixture();const actor=battle.sides.A.roster[0];actor.activeAbilityId='drizzle';actor.passiveEffects=effects('drizzle');battle.sides.A.conditions.spikes={id:'spikes',layers:1,order:1};const result=resolveEntryHazards(battle,[switchIn('a1','A')]);assert.equal(result.battle.field.weather.id,'rain');assert.ok(result.battle.sides.A.roster[0].hp<300);const weatherIndex=result.events.findIndex(event=>event.kind==='weatherStarted'),hazardIndex=result.events.findIndex(event=>event.kind==='hazardTriggered');assert.ok(weatherIndex>=0&&hazardIndex>weatherIndex);
});
