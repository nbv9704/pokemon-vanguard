import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applySecondaryEffects,compilePassiveEffects,resolveTargetAbilityBlock
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=id=>compilePassiveEffects({abilityId:id,manifests});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-wave6-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:17,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const ids=['heatproof','thick-fat','keen-eye','illuminate','water-absorb','volt-absorb','earth-eater','motor-drive','sap-sipper','rough-skin','flame-body','static','poison-point','gooey'];
const move=(type='normal',category='physical',power=80)=>({id:`test-${type}-${category}`,name:'Test Move',type,category,power,accuracy:100,maxPP:16});

for(const format of ['single','double'])test(`r3-ability-hooks-wave6:${format} compiles candidate-backed damage, immunity, and contact responses`,()=>{
 for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(fixture(format).format,format);
});

test('Heatproof and Thick Fat reuse received type damage reduction without affecting unrelated types',()=>{
 const fire=move('fire','special'),ice=move('ice','special'),water=move('water','special');
 const hit=(abilityId,testMove)=>{const battle=fixture();battle.sides.B.roster[0].passiveEffects=abilityId?effects(abilityId):[];const rolls=[.99,.99];return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:testMove,mechanics:{contact:false,tags:[]}}, {nextRandom:()=>rolls.shift()??.99}).events.find(event=>event.kind==='damage');};
 const plainFire=hit(null,fire),heatproof=hit('heatproof',fire),thickFire=hit('thick-fat',fire),thickIce=hit('thick-fat',ice),thickWater=hit('thick-fat',water),plainWater=hit(null,water);
 assert.ok(heatproof.amount<plainFire.amount);assert.ok(thickFire.amount<plainFire.amount);assert.ok(thickIce.breakdown.passiveModifiers.some(entry=>entry.sourceId==='thick-fat'));assert.equal(thickWater.amount,plainWater.amount);
});

test('Keen Eye and Illuminate block opponent accuracy drops but do not grant blanket stat-drop immunity',()=>{
 for(const abilityId of ['keen-eye','illuminate']){
  let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);
  let result=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'accuracy-drop',effects:[{kind:'stat-stages',chance:100,boosts:{accuracy:-1}}]},{nextRandom:()=>0});
  assert.equal(result.battle.sides.B.roster[0].stages.accuracy,0);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.sourceAbilityId===abilityId));
  result=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'attack-drop',effects:[{kind:'stat-stages',chance:100,boosts:{atk:-1}}]},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].stages.atk,-1);
 }
});

test('absorb-family type immunities heal or boost a stage while blocking the incoming move',()=>{
 const cases=[
  ['water-absorb','water','heal',null],['volt-absorb','electric','heal',null],['earth-eater','ground','heal',null],
  ['motor-drive','electric','stat','spe'],['sap-sipper','grass','stat','atk']
 ];
 for(const [abilityId,type,response,stat] of cases){
  const battle=fixture();const target=battle.sides.B.roster[0];target.passiveEffects=effects(abilityId);target.hp=160;
  const result=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'b1',move:move(type,'special'),mechanics:{contact:false,tags:[]}});assert.equal(result.blocked,true,abilityId);const updated=result.battle.sides.B.roster[0];
  if(response==='heal')assert.equal(updated.hp,240,abilityId);else{assert.equal(updated.hp,160,abilityId);assert.equal(updated.stages[stat],1,abilityId);}
  assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.abilityId===abilityId),abilityId);
 }
});

test('Rough Skin and Gooey resolve on actual contact damage and respect attacker stat-drop immunity',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('rough-skin');let rolls=[.99,.99];let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('normal','physical'),mechanics:{contact:true,tags:[]}}, {nextRandom:()=>rolls.shift()??.99});assert.equal(result.battle.sides.A.roster[0].hp,280);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='rough-skin'));
 battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('gooey');rolls=[.99,.99];result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('normal','physical'),mechanics:{contact:true,tags:[]}}, {nextRandom:()=>rolls.shift()??.99});assert.equal(result.battle.sides.A.roster[0].stages.spe,-1);
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('clear-body');battle.sides.B.roster[0].passiveEffects=effects('gooey');rolls=[.99,.99];result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('normal','physical'),mechanics:{contact:true,tags:[]}}, {nextRandom:()=>rolls.shift()??.99});assert.equal(result.battle.sides.A.roster[0].stages.spe,0);assert.ok(result.events.some(event=>event.kind==='statStageBlocked'&&event.sourceAbilityId==='clear-body'));
});

test('Flame Body, Static, and Poison Point use seeded contact RNG and major-status immunity rules',()=>{
 const cases=[['flame-body','burn'],['static','paralysis'],['poison-point','poison']];
 for(const [abilityId,status] of cases){
  let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);let rolls=[.99,.99,0];let result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('normal','physical'),mechanics:{contact:true,tags:[]}}, {nextRandom:()=>rolls.shift()??.99});assert.equal(result.battle.sides.A.roster[0].status.id,status,abilityId);
  battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);rolls=[.99,.99,.99];result=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:move('normal','physical'),mechanics:{contact:true,tags:[]}}, {nextRandom:()=>rolls.shift()??.99});assert.equal(result.battle.sides.A.roster[0].status,null,abilityId);
 }
});
