import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applyMajorStatus,compilePassiveEffects,createHeldItemState,fixedDamageHandler,resolveEntryAbilities,resolveMechanicsEndTurn
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId=null,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},maxPp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave7-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:23,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const ids=['anger-point','berserk','justified','moxie','sand-spit','speed-boost','stamina','sturdy','toxic-debris','water-bubble','weak-armor'];
const move=(type='normal',category='physical',power=20,contact=false)=>({id:`test-${type}-${category}-${power}`,name:'Test Move',type,category,power,accuracy:100,maxPP:16,contact});
const hit=(battle,testMove,{critical=false,mechanics={contact:false,tags:[]}}={})=>{const rolls=[critical?0:.99,.99];return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:testMove,mechanics}, {nextRandom:()=>rolls.shift()??.99});};

for(const format of ['single','double'])test(`r3-ability-hooks-wave7:${format} compiles candidate-backed damaged-response and survival abilities`,()=>{
 for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(fixture(format).format,format);
});

test('Anger Point requires a critical hit while Berserk triggers only on the first half-HP threshold crossing',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('anger-point');let result=hit(battle,move('normal','physical',20),{critical:false});assert.equal(result.battle.sides.B.roster[0].stages.atk,0);
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('anger-point');result=hit(battle,move('normal','physical',20),{critical:true});assert.equal(result.battle.sides.B.roster[0].stages.atk,6);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='anger-point'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('berserk');battle.sides.B.roster[0].hp=170;result=hit(battle,move('normal','special',20));assert.ok(result.battle.sides.B.roster[0].hp<=160);assert.equal(result.battle.sides.B.roster[0].stages.spa,1);
 const second=hit(result.battle,move('normal','special',20));assert.equal(second.battle.sides.B.roster[0].stages.spa,1);
});

test('Justified, Stamina, and Weak Armor react only to matching damaging hits and White Herb cleans the self-drop',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('justified');let result=hit(battle,move('dark','physical',20));assert.equal(result.battle.sides.B.roster[0].stages.atk,1);result=hit(result.battle,move('normal','physical',20));assert.equal(result.battle.sides.B.roster[0].stages.atk,1);
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('stamina');result=hit(battle,move('normal','special',20));assert.equal(result.battle.sides.B.roster[0].stages.def,1);
 battle=fixture();const armor=battle.sides.B.roster[0];armor.itemState=createHeldItemState('white-herb');armor.passiveEffects=effects('weak-armor','white-herb');result=hit(battle,move('normal','physical',20));assert.equal(result.battle.sides.B.roster[0].stages.def,0);assert.equal(result.battle.sides.B.roster[0].stages.spe,2);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='itemConsumed'&&event.itemId==='white-herb'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('weak-armor');result=hit(battle,move('normal','special',20));assert.equal(result.battle.sides.B.roster[0].stages.def,0);assert.equal(result.battle.sides.B.roster[0].stages.spe,0);
});

test('Sand Spit starts Sandstorm and Toxic Debris layers Toxic Spikes only after physical damage',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('sand-spit');let result=hit(battle,move('normal','special',20));assert.equal(result.battle.field.weather.id,'sandstorm');assert.equal(result.battle.field.weather.remaining,5);
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('toxic-debris');result=hit(battle,move('normal','special',20));assert.equal(result.battle.sides.A.conditions['toxic-spikes'],undefined);
 result=hit(result.battle,move('normal','physical',20));assert.equal(result.battle.sides.A.conditions['toxic-spikes'].layers,1);result=hit(result.battle,move('normal','physical',20));assert.equal(result.battle.sides.A.conditions['toxic-spikes'].layers,2);const capped=hit(result.battle,move('normal','physical',20));assert.equal(capped.battle.sides.A.conditions['toxic-spikes'].layers,2);
});

test('Sturdy protects full HP before Focus Sash and stops protecting once the holder is no longer full',()=>{
 let battle=fixture();const target=battle.sides.B.roster[0];target.itemState=createHeldItemState('focus-sash');target.passiveEffects=effects('sturdy','focus-sash');let result=hit(battle,move('normal','physical',999));assert.equal(result.battle.sides.B.roster[0].hp,1);assert.equal(result.battle.sides.B.roster[0].itemState.consumed,false);const damage=result.events.find(event=>event.kind==='damage');assert.equal(damage.breakdown.abilitySurvival.sourceId,'sturdy');assert.equal(damage.breakdown.itemSurvival,undefined);
 result=hit(result.battle,move('normal','physical',999));assert.equal(result.battle.sides.B.roster[0].hp,0);assert.ok(result.events.some(event=>event.kind==='fainted'&&event.targetId==='b1'));
});

test('Moxie boosts a surviving attacker after its damaging move knocks out the target',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('moxie');battle.sides.B.roster[0].hp=10;const result=hit(battle,move('normal','physical',40));assert.equal(result.battle.sides.B.roster[0].hp,0);assert.equal(result.battle.sides.A.roster[0].stages.atk,1);const triggerIndex=result.events.findIndex(event=>event.kind==='abilityTriggered'&&event.abilityId==='moxie'),faintIndex=result.events.findIndex(event=>event.kind==='fainted'&&event.targetId==='b1');assert.ok(triggerIndex>=0&&faintIndex>triggerIndex);
});

test('Speed Boost skips the switch-in turn and then raises Speed once per later end turn',()=>{
 let battle=fixture();const actor=battle.sides.A.roster[0];actor.passiveEffects=effects('speed-boost');battle=resolveEntryAbilities(battle,[{kind:'switchIn',actorId:'a1',side:'A',slot:0}]).battle;battle.phase='END_TURN';let result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.equal(result.battle.turn,2);
 battle=result.battle;battle.phase='END_TURN';result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.A.roster[0].stages.spe,1);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='speed-boost'));
});

test('Water Bubble halves incoming Fire damage and blocks burn without granting unrelated status immunity',()=>{
 const fire=move('fire','special',80);let plain=fixture(),bubble=fixture();bubble.sides.B.roster[0].passiveEffects=effects('water-bubble');const plainHit=hit(plain,fire),bubbleHit=hit(bubble,fire);assert.ok(bubbleHit.amount<plainHit.amount);assert.ok(bubbleHit.events.find(event=>event.kind==='damage').breakdown.passiveModifiers.some(entry=>entry.sourceId==='water-bubble'));
 let status=applyMajorStatus(bubble,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},{nextRandom:()=>.5});assert.equal(status.battle.sides.B.roster[0].status,null);assert.equal(status.events[0].sourceAbilityId,'water-bubble');status=applyMajorStatus(bubble,{actorId:'a1',targetId:'b1',moveId:'toxic',status:'poison'},{nextRandom:()=>.5});assert.equal(status.battle.sides.B.roster[0].status.id,'poison');
});

test('fixed-damage hits share Sturdy and contact Ability response pipelines',()=>{
 let battle=fixture();battle.sides.B.roster[0].hp=50;battle.sides.B.roster[0].maxHp=50;battle.sides.B.roster[0].stats.hp=50;battle.sides.B.roster[0].passiveEffects=effects('sturdy');const fixedMove={id:'fixed-contact',name:'Fixed Contact',type:'normal',category:'physical',power:1,accuracy:100,maxPP:16};const payload={action:{side:'A',actorId:'a1',target:{side:'B',slot:0}},move:fixedMove,mechanics:{targetMode:'adjacentFoe',contact:true,tags:[]}};let result=fixedDamageHandler.run({battle,payload,params:{formula:'user-level'},runtime:{nextRandom:()=>.99}});assert.equal(result.battle.sides.B.roster[0].hp,1);assert.ok(result.events.some(event=>event.kind==='survivalTriggered'&&event.abilityId==='sturdy'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('rough-skin');result=fixedDamageHandler.run({battle,payload:{...payload},params:{formula:'user-level'},runtime:{nextRandom:()=>.99}});assert.equal(result.battle.sides.A.roster[0].hp,280);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='rough-skin'));
});
