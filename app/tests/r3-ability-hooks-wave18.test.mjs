import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 abilityPowerModifiers,
 compilePassiveEffects,
 createHeldItemState,
 effectiveWeightKg,
 resolveContactAbilityResponses,
 validateMechanicManifest,
 variableMovePower
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const promotedAbilities=['cute-charm','rivalry','heavy-metal','light-metal'];
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const effects=(abilityId=null,itemId=null)=>compilePassiveEffects({abilityId,itemId,manifests});
const unit=(actorId,overrides={})=>({actorId,speciesId:'fixture',types:['normal'],gender:'male',weightKg:100,hp:240,maxHp:240,stats:{hp:240,atk:120,def:120,spa:120,spd:120,spe:100},pp:{hit:16},status:null,volatiles:{},stages:stages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),buildSnapshot:{abilityId:null,itemId:null,moveIds:['hit']},...overrides});
function fixture(format='single'){const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];return {id:`ability-wave18-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:17,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};}
const move={id:'hit',name:'Hit',type:'normal',category:'physical',power:80,accuracy:100,maxPP:16};
const mechanics=(overrides={})=>({contact:true,tags:[],targetMode:'adjacentFoe',...overrides});
function setAbility(mon,id){mon.activeAbilityId=id;mon.buildSnapshot.abilityId=id;mon.passiveEffects=effects(id,mon.buildSnapshot.itemId);return mon;}
function setItem(mon,id){mon.buildSnapshot.itemId=id;mon.itemState=createHeldItemState(id);mon.passiveEffects=effects(mon.activeAbilityId||mon.buildSnapshot.abilityId,id);return mon;}

for(const format of ['single','double'])test(`r3-ability-hooks-wave18:${format} validates final foundation-backed Ability manifests`,()=>{
 for(const id of promotedAbilities)assert.deepEqual(validateMechanicManifest(manifests.abilities[id],'abilities'),[],id);
 assert.equal(fixture(format).format,format);
});

test('Rivalry modifies base power only when both battlers have binary genders',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];setAbility(actor,'rivalry');
 actor.gender='male';target.gender='male';let mod=abilityPowerModifiers(actor,move,mechanics(),{battle,target});assert.equal(mod.apply(80),100);assert.equal(mod.applied[0].sourceId,'rivalry');
 target.gender='female';mod=abilityPowerModifiers(actor,move,mechanics(),{battle,target});assert.equal(mod.apply(80),60);
 target.gender='genderless';mod=abilityPowerModifiers(actor,move,mechanics(),{battle,target});assert.equal(mod.apply(80),80);assert.equal(mod.applied.length,0);
});

test('Heavy Metal and Light Metal modify post-Autotomize effective weight with a 0.1 kg floor',()=>{
 const heavy=unit('heavy',{weightKg:155.5,volatiles:{'weight-reduction':{reductionHg:1000}},passiveEffects:effects('heavy-metal')});
 const light=unit('light',{weightKg:100,volatiles:{'weight-reduction':{reductionHg:1000}},passiveEffects:effects('light-metal')});
 assert.equal(effectiveWeightKg(heavy),111); // (155.5 - 100) * 2
 assert.equal(effectiveWeightKg(heavy,{ignoreAbility:true}),55.5);
 assert.equal(effectiveWeightKg(light),0.1);
 assert.equal(effectiveWeightKg(light,{ignoreAbility:true}),0.1);
});

test('weight-based moves consume Heavy/Light Metal and Mold Breaker can ignore only the target weight Ability',()=>{
 const battle=fixture(),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0];actor.weightKg=100;target.weightKg=60;setAbility(target,'heavy-metal');
 assert.equal(variableMovePower('target-weight-tier',{battle,actor,target,basePower:20,mechanics:mechanics()}),100);
 assert.equal(variableMovePower('target-weight-tier',{battle,actor,target,basePower:20,mechanics:mechanics({opponentAbilitiesIgnored:true})}),80);
 setAbility(actor,'heavy-metal');setAbility(target,'light-metal');actor.weightKg=100;target.weightKg=100;
 assert.equal(variableMovePower('user-target-weight-ratio',{battle,actor,target,basePower:40,mechanics:mechanics()}),100); // 200 / 50 = 4x
 assert.equal(variableMovePower('user-target-weight-ratio',{battle,actor,target,basePower:40,mechanics:mechanics({opponentAbilitiesIgnored:true})}),60); // own 2x remains, target reverts to 100
});

test('Cute Charm shares Attract compatibility, Oblivious blocking, and Mental Herb cure lifecycle',()=>{
 let battle=fixture();const attacker=battle.sides.A.roster[0],holder=battle.sides.B.roster[0];attacker.gender='male';holder.gender='female';setAbility(holder,'cute-charm');
 let result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:40},{nextRandom:()=>0});
 assert.equal(result.battle.sides.A.roster[0].volatiles.infatuation?.sourceId,'b1');assert.ok(result.events.some(event=>event.kind==='volatileApplied'&&event.abilityId==='cute-charm'));
 battle=fixture();battle.sides.A.roster[0].gender='male';battle.sides.B.roster[0].gender='female';setAbility(battle.sides.A.roster[0],'oblivious');setAbility(battle.sides.B.roster[0],'cute-charm');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:40},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].volatiles.infatuation,undefined);assert.ok(result.events.some(event=>event.kind==='volatileFailed'&&event.sourceAbilityId==='oblivious'));
 battle=fixture();battle.sides.A.roster[0].gender='male';battle.sides.B.roster[0].gender='female';setAbility(battle.sides.B.roster[0],'cute-charm');setItem(battle.sides.A.roster[0],'mental-herb');result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics(),damage:40},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].volatiles.infatuation,undefined);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);assert.ok(result.events.some(event=>event.kind==='volatileEnded'&&event.itemId==='mental-herb'));
});

test('post-hit contact responses are not suppressed by Mold Breaker-style target Ability bypass',()=>{
 const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('rough-skin');const result=resolveContactAbilityResponses(battle,{attackerId:'a1',targetId:'b1',moveId:'hit',mechanics:mechanics({opponentAbilitiesIgnored:true}),damage:40,ignoreTargetAbility:true},{nextRandom:()=>0});assert.equal(result.battle.sides.A.roster[0].hp,210);assert.ok(result.events.some(event=>event.abilityId==='rough-skin'));
});
