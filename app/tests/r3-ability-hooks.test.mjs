import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applyMajorStatus,applySecondaryEffects,applyStatStagesHandler,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,effectiveBattleSpeed,HANDLER_DEFINITIONS,
 modifyMoveByAbility,resolveFlinchItems,resolveMechanicsEndTurn,resolveProtectionBlock,resolveTargetAbilityBlock,scheduleDelayedEffect,speedWithWeather
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const moveMap=Object.fromEntries(allMoves.filter(move=>['bullet-seed','brave-bird','drain-punch','hyper-voice','yawn'].includes(move.id)).map(move=>[move.id,move]));
moveMap['test-fire']={id:'test-fire',name:'Test Fire',type:'fire',category:'special',power:80,accuracy:100,maxPP:16};
moveMap['test-bullet']={id:'test-bullet',name:'Test Bullet',type:'normal',category:'special',power:50,accuracy:50,maxPP:16};
moveMap['test-physical']={id:'test-physical',name:'Test Physical',type:'normal',category:'physical',power:50,accuracy:50,maxPP:16};
const localManifests=structuredClone(manifests.moves);
for(const [id,tags=[]] of [['test-fire',[]],['test-bullet',['bullet']],['test-physical',[]]])localManifests[id]={id,targetMode:'adjacentFoe',priority:0,contact:false,tags,handlers:[{id:'spend-pp',hook:'onTryMove',order:10},{id:'check-accuracy',hook:'onMove',order:90},{id:'deal-direct-damage',hook:'onMove',order:100}],testEvidence:{single:['r3-ability-hooks:single'],double:['r3-ability-hooks:double']}};
const resolveMove=createMoveActionHandler({moves:moveMap,manifests:localManifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(Object.values(moveMap).map(move=>[move.id,move.maxPP||16]));
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:320,maxHp:320,stats:{hp:320,atk:120,def:120,spa:120,spd:120,spe:100},pp:pp(),status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`ability-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:19,field:{},sides:{A:{active:a.slice(0,count).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(side,actorId,moveId,target)=>({kind:'move',side,actorId,moveId,target,speed:100,priority:0});
const targetB={side:'B',slot:0};
const seeded={nextRandom:()=>.999};
const effects=id=>compilePassiveEffects({abilityId:id,manifests});

function directDamage({abilityId=null,move={id:'hit',type:'normal',category:'special',power:80},mechanics={tags:[]},weather=null,criticalRoll=.999,format='single'}={}){
 const battle=fixture(format);battle.field.weather=weather?{id:weather,remaining:5}:undefined;battle.sides.A.roster[0].types=[move.type];if(abilityId)battle.sides.A.roster[0].passiveEffects=effects(abilityId);
 const rolls=[criticalRoll,.999],runtime={nextRandom:()=>rolls.shift()??.999};return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move,mechanics},runtime).events.find(event=>event.kind==='damage');
}

test('r3-ability-hooks:single Solar Power boosts SpA in sun and applies 1/8 residual damage',()=>{
 const move={id:'solar-hit',type:'fire',category:'special',power:80},boosted=directDamage({abilityId:'solar-power',move,weather:'sun'}),plain=directDamage({move,weather:'sun'});
 assert.ok(boosted.amount>plain.amount);assert.deepEqual(boosted.breakdown.abilityStatModifiers.map(x=>x.sourceId),['solar-power']);
 const battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'sun',remaining:5};battle.sides.A.roster[0].passiveEffects=effects('solar-power');const result=resolveMechanicsEndTurn(battle);
 assert.equal(result.battle.sides.A.roster[0].hp,280);assert.ok(result.events.some(event=>event.kind==='damage'&&event.targetId==='a1'&&event.source==='weather-ability-damage'));
});

test('Leaf Guard blocks direct major status and Yawn scheduling only during sun',()=>{
 let battle=fixture();battle.field.weather={id:'sun',remaining:5};battle.sides.B.roster[0].passiveEffects=effects('leaf-guard');
 let status=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},seeded);assert.equal(status.battle.sides.B.roster[0].status,null);assert.equal(status.events[0].reason,'abilityBlocked');assert.equal(status.events[0].sourceAbilityId,'leaf-guard');
 let yawn=scheduleDelayedEffect(battle,{actorId:'a1',targetId:'b1',moveId:'yawn',effect:'yawn',turns:2});assert.equal(yawn.applied,false);assert.equal(yawn.events[0].reason,'abilityBlocked');
 battle.field.weather={id:'rain',remaining:5};status=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'will-o-wisp',status:'burn'},seeded);assert.equal(status.battle.sides.B.roster[0].status.id,'burn');
});

test('Flash Fire blocks Fire moves, activates once, and boosts later Fire offense',()=>{
 const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('flash-fire');
 const block=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'b1',move:moveMap['test-fire'],mechanics:localManifests['test-fire']});assert.equal(block.blocked,true);assert.equal(block.battle.sides.B.roster[0].volatiles['flash-fire'].id,'flash-fire');
 const boostedBattle=structuredClone(block.battle);boostedBattle.sides.B.roster[0].types=['fire'];const base=fixture();base.sides.B.roster[0].types=['fire'];
 const attackMove={id:'fire-hit',type:'fire',category:'special',power:80};const boosted=applyDamageHit(boostedBattle,{actorId:'b1',targetId:'a1',move:attackMove,mechanics:{tags:[]}},seeded).events.find(e=>e.kind==='damage');
 base.sides.B.roster[0].passiveEffects=effects('flash-fire');const plain=applyDamageHit(base,{actorId:'b1',targetId:'a1',move:attackMove,mechanics:{tags:[]}},seeded).events.find(e=>e.kind==='damage');assert.ok(boosted.amount>plain.amount);assert.deepEqual(boosted.breakdown.abilityStatModifiers.map(x=>x.sourceId),['flash-fire']);
});

test('Sniper amplifies only critical-hit damage',()=>{
 const move={id:'crit-hit',type:'normal',category:'physical',power:80},sniper=directDamage({abilityId:'sniper',move,criticalRoll:0}),normal=directDamage({move,criticalRoll:0}),noncrit=directDamage({abilityId:'sniper',move,criticalRoll:.999});
 assert.equal(sniper.breakdown.critical,1.5);assert.ok(sniper.amount>normal.amount);assert.deepEqual(sniper.breakdown.passiveModifiers.map(x=>x.sourceId),['sniper']);assert.equal(noncrit.breakdown.passiveModifiers.length,0);
});

test('Technician and Iron Fist use validated base-power and punch-tag hooks',()=>{
 const weak={id:'weak',type:'normal',category:'physical',power:40},strong={...weak,id:'strong',power:80};
 const techWeak=directDamage({abilityId:'technician',move:weak}),plainWeak=directDamage({move:weak}),techStrong=directDamage({abilityId:'technician',move:strong});assert.ok(techWeak.amount>plainWeak.amount);assert.equal(techWeak.breakdown.abilityPowerModifiers[0].sourceId,'technician');assert.equal(techStrong.breakdown.abilityPowerModifiers.length,0);
 const punch=directDamage({abilityId:'iron-fist',move:weak,mechanics:{tags:['punch']}}),untagged=directDamage({abilityId:'iron-fist',move:weak,mechanics:{tags:[]}});assert.ok(punch.amount>untagged.amount);assert.equal(punch.breakdown.abilityPowerModifiers[0].sourceId,'iron-fist');
});

test('Bulletproof blocks a bullet-tagged move before accuracy resolution',()=>{
 const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('bulletproof');let randomCalls=0;const result=resolveMove(battle,action('A','a1','test-bullet',targetB),{nextRandom(){randomCalls++;return 0;}});
 assert.equal(result.battle.sides.B.roster[0].hp,320);assert.equal(randomCalls,0);assert.ok(result.events.some(event=>event.kind==='moveBlocked'&&event.reason==='abilityImmune'&&event.abilityId==='bulletproof'));
});

test('Long Reach removes contact before protection retaliation is evaluated',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('long-reach');battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'spiky-shield',retaliation:'spiky-damage',blocksStatus:true,endTurnTimer:1};
 const transformed=modifyMoveByAbility(battle.sides.A.roster[0],moveMap['drain-punch'],manifests.moves['drain-punch']);assert.equal(transformed.mechanics.contact,false);
 const result=resolveMove(battle,action('A','a1','drain-punch',targetB),seeded);assert.equal(result.battle.sides.A.roster[0].hp,320);assert.ok(result.events.some(event=>event.kind==='moveBlocked'));assert.ok(!result.events.some(event=>event.kind==='damage'&&event.targetId==='a1'));
});

test('Liquid Voice converts sound-tagged Hyper Voice to Water before spread damage',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].types=['water','fairy'];battle.sides.A.roster[0].passiveEffects=effects('liquid-voice');battle.sides.B.roster[0].types=['fire'];battle.sides.B.roster[1].types=['fire'];
 const result=resolveMove(battle,action('A','a1','hyper-voice'),seeded),damages=result.events.filter(event=>event.kind==='damage'&&event.actorId==='a1');assert.equal(damages.length,2);assert.ok(damages.every(event=>event.effectiveness===2));assert.ok(damages.every(event=>event.breakdown.stab===1.5));assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='liquid-voice'&&event.toType==='water'));
});

test('r3-ability-hooks:double target-local immunity and attacker-local transforms stay isolated',()=>{
 const battle=fixture('double');battle.sides.A.roster[0].types=['water','fairy'];battle.sides.A.roster[0].passiveEffects=effects('liquid-voice');battle.sides.B.roster[0].passiveEffects=effects('bulletproof');battle.sides.B.roster[1].passiveEffects=[];
 const sound=resolveMove(battle,action('A','a1','hyper-voice'),seeded);assert.equal(sound.events.filter(event=>event.kind==='damage').length,2);
 const bullet=resolveMove(battle,action('A','a1','test-bullet',{side:'B',slot:0}),seeded);assert.ok(bullet.events.some(event=>event.kind==='moveBlocked'&&event.abilityId==='bulletproof'));assert.equal(bullet.battle.sides.B.roster[1].hp,320);
});


test('Sand Rush and Slush Rush double Speed only in their matching weather',()=>{
 const sand=unit('sand',{passiveEffects:effects('sand-rush')}),slush=unit('slush',{passiveEffects:effects('slush-rush')});
 assert.equal(speedWithWeather(101,sand,{field:{weather:{id:'sandstorm'}}}),202);
 assert.equal(speedWithWeather(101,sand,{field:{weather:{id:'snow'}}}),101);
 assert.equal(speedWithWeather(99,slush,{field:{weather:{id:'snow'}}}),198);
 assert.equal(speedWithWeather(99,slush,{field:{weather:{id:'sandstorm'}}}),99);
});

test('Ice Body heals in Snow while Sand Force boosts only Rock Ground and Steel attacks in sand',()=>{
 const snow=fixture();snow.phase='END_TURN';snow.field.weather={id:'snow',remaining:3};snow.sides.A.roster[0].hp=300;snow.sides.A.roster[0].passiveEffects=effects('ice-body');
 const healed=resolveMechanicsEndTurn(snow);assert.equal(healed.battle.sides.A.roster[0].hp,320);assert.ok(healed.events.some(event=>event.kind==='heal'&&event.targetId==='a1'&&event.amount===20));
 for(const type of ['rock','ground','steel']){
  const move={id:`sand-force-${type}`,type,category:'physical',power:80},boosted=directDamage({abilityId:'sand-force',move,weather:'sandstorm'}),plain=directDamage({move,weather:'sandstorm'});
  assert.ok(boosted.amount>plain.amount);assert.ok(boosted.breakdown.passiveModifiers.some(entry=>entry.sourceId==='sand-force'));
 }
 const normalMove={id:'sand-force-normal',type:'normal',category:'physical',power:80},normal=directDamage({abilityId:'sand-force',move:normalMove,weather:'sandstorm'}),plainNormal=directDamage({move:normalMove,weather:'sandstorm'});
 assert.equal(normal.amount,plainNormal.amount);assert.ok(!normal.breakdown.passiveModifiers.some(entry=>entry.sourceId==='sand-force'));
});

test('Sand Veil and Snow Cloak reduce incoming accuracy only in matching weather',()=>{
 for(const [abilityId,weather] of [['sand-veil','sandstorm'],['snow-cloak','snow']]){
  const battle=fixture();battle.field.weather={id:weather,remaining:4};battle.sides.B.roster[0].passiveEffects=effects(abilityId);
  const result=resolveMove(battle,action('A','a1','test-bullet',targetB),{nextRandom:()=>.45});
  const miss=result.events.find(event=>event.kind==='moveMissed');assert.ok(miss);assert.equal(miss.effectiveAccuracy,40);assert.equal(result.battle.sides.B.roster[0].hp,320);
  const offWeather=fixture();offWeather.field.weather={id:weather==='snow'?'sandstorm':'snow',remaining:4};offWeather.sides.B.roster[0].passiveEffects=effects(abilityId);
  const hit=resolveMove(offWeather,action('A','a1','test-bullet',targetB),{nextRandom:()=>.45});assert.ok(hit.events.some(event=>event.kind==='damage'));
 }
});

test('Sand Veil also grants Sandstorm residual immunity without protecting unrelated allies',()=>{
 const battle=fixture('double');battle.phase='END_TURN';battle.field.weather={id:'sandstorm',remaining:3};battle.sides.A.roster[0].passiveEffects=effects('sand-veil');
 const result=resolveMechanicsEndTurn(battle);assert.equal(result.battle.sides.A.roster[0].hp,320);assert.equal(result.battle.sides.A.roster[1].hp,300);assert.ok(result.events.some(event=>event.kind==='damage'&&event.targetId==='a2'&&event.source==='weather-residual-damage'));assert.ok(!result.events.some(event=>event.kind==='damage'&&event.targetId==='a1'&&event.source==='weather-residual-damage'));
});


test('static stat abilities apply attacker and defender multipliers without leaking across damage categories',()=>{
 const physical={id:'physical-hit',type:'normal',category:'physical',power:80},special={id:'special-hit',type:'normal',category:'special',power:80};
 for(const abilityId of ['huge-power','pure-power']){
  const boosted=directDamage({abilityId,move:physical}),plain=directDamage({move:physical});assert.ok(boosted.amount>plain.amount);assert.ok(boosted.breakdown.abilityStatModifiers.some(entry=>entry.sourceId===abilityId));
 }
 const fur=fixture();fur.sides.B.roster[0].passiveEffects=effects('fur-coat');const physicalHit=applyDamageHit(fur,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');
 const plainPhysical=directDamage({move:physical});assert.ok(physicalHit.amount<plainPhysical.amount);assert.ok(physicalHit.breakdown.abilityDefenseModifiers.some(entry=>entry.sourceId==='fur-coat'));
 const furSpecial=fixture();furSpecial.sides.B.roster[0].passiveEffects=effects('fur-coat');const specialHit=applyDamageHit(furSpecial,{actorId:'a1',targetId:'b1',move:special,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(specialHit.amount,directDamage({move:special}).amount);
});

test('Compound Eyes boosts outgoing accuracy before target-local evasion modifiers',()=>{
 const plain=fixture();let plainRandom=[.6,.9,.9];const plainResult=resolveMove(plain,action('A','a1','test-bullet',targetB),{nextRandom:()=>plainRandom.shift()??.9});assert.ok(plainResult.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===50));
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('compound-eyes');let rolls=[.6,.9,.9];const result=resolveMove(battle,action('A','a1','test-bullet',targetB),{nextRandom:()=>rolls.shift()??.9});assert.ok(result.events.some(event=>event.kind==='damage'));
 const veil=fixture();veil.field.weather={id:'sandstorm',remaining:3};veil.sides.A.roster[0].passiveEffects=effects('compound-eyes');veil.sides.B.roster[0].passiveEffects=effects('sand-veil');let veilRolls=[.55,.9,.9];const veilResult=resolveMove(veil,action('A','a1','test-bullet',targetB),{nextRandom:()=>veilRolls.shift()??.9});assert.ok(veilResult.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===52));
});

test('move-property power abilities use bite slicing pulse contact and recoil contracts',()=>{
 const move={id:'property-hit',type:'normal',category:'physical',power:80};
 for(const [abilityId,mechanics] of [
  ['strong-jaw',{tags:['bite']}],['sharpness',{tags:['slicing']}],['mega-launcher',{tags:['pulse']}],['tough-claws',{tags:[],contact:true}],['reckless',{tags:[],contact:true,handlers:[{id:'apply-recoil'}]}]
 ]){
  const boosted=directDamage({abilityId,move,mechanics}),plain=directDamage({move,mechanics});assert.ok(boosted.amount>plain.amount,abilityId);assert.ok(boosted.breakdown.abilityPowerModifiers.some(entry=>entry.sourceId===abilityId),abilityId);
 }
 assert.deepEqual(manifests.moves['crunch'].tags,['bite']);assert.deepEqual(manifests.moves['ice-fang'].tags,['bite']);assert.deepEqual(manifests.moves['water-pulse'].tags,['pulse']);assert.deepEqual(manifests.moves['aerial-ace'].tags,['slicing']);assert.deepEqual(manifests.moves['solar-blade'].tags,['slicing']);
});

test('Super Luck raises critical ratio while Shell Armor prevents critical hits',()=>{
 const move={id:'crit-test',type:'normal',category:'physical',power:80},superLuck=directDamage({abilityId:'super-luck',move,criticalRoll:.1}),plain=directDamage({move,criticalRoll:.1});assert.equal(superLuck.breakdown.critical,1.5);assert.equal(plain.breakdown.critical,1);
 for(const abilityId of ['shell-armor']){
  const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);const rolls=[0,.999];const damage=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move,mechanics:{tags:[]}}, {nextRandom:()=>rolls.shift()??.999}).events.find(event=>event.kind==='damage');assert.equal(damage.breakdown.critical,1,abilityId);
 }
});

test('static major-status immunity abilities block their complete status families',()=>{
 const cases=[['insomnia',['sleep']],['vital-spirit',['sleep']],['limber',['paralysis']],['immunity',['poison','bad-poison']],['magma-armor',['freeze']]];
 for(const [abilityId,statuses] of cases)for(const status of statuses){const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);const result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'status-test',status},{nextRandom:()=>0});assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.events[0].reason,'abilityBlocked');assert.equal(result.events[0].sourceAbilityId,abilityId);}
});

test('Adaptability uses a 2x STAB modifier and Soundproof blocks sound-tagged attacks',()=>{
 const move={id:'stab-test',type:'normal',category:'special',power:80},adapted=directDamage({abilityId:'adaptability',move}),plain=directDamage({move});assert.equal(adapted.breakdown.stab,2);assert.equal(plain.breakdown.stab,1.5);assert.ok(adapted.amount>plain.amount);
 const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('soundproof');const blocked=resolveMove(battle,action('A','a1','hyper-voice',targetB),seeded);assert.equal(blocked.battle.sides.B.roster[0].hp,320);assert.ok(blocked.events.some(event=>event.kind==='moveBlocked'&&event.abilityId==='soundproof'));
});

test('Rock Head suppresses move recoil only and leaves dealt damage intact',()=>{
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('rock-head');const result=resolveMove(battle,action('A','a1','brave-bird',targetB),seeded);assert.ok(result.events.some(event=>event.kind==='damage'&&event.targetId==='b1'));assert.equal(result.battle.sides.A.roster[0].hp,320);assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='rock-head'));
});


test('Marvel Scale, Multiscale, and Solid Rock apply only under their declared defensive conditions',()=>{
 const physical={id:'physical',type:'normal',category:'physical',power:80};
 const marvel=fixture();marvel.sides.B.roster[0].status={id:'burn'};marvel.sides.B.roster[0].passiveEffects=effects('marvel-scale');const marvelDamage=applyDamageHit(marvel,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');
 const burnedPlain=fixture();burnedPlain.sides.B.roster[0].status={id:'burn'};const plainDamage=applyDamageHit(burnedPlain,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(marvelDamage.amount<plainDamage.amount);assert.ok(marvelDamage.breakdown.abilityDefenseModifiers.some(entry=>entry.sourceId==='marvel-scale'));
 const noStatus=fixture();noStatus.sides.B.roster[0].passiveEffects=effects('marvel-scale');const noStatusDamage=applyDamageHit(noStatus,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(noStatusDamage.amount,directDamage({move:physical}).amount);
 const multi=fixture();multi.sides.B.roster[0].passiveEffects=effects('multiscale');const full=applyDamageHit(multi,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(full.breakdown.passiveModifiers.some(entry=>entry.sourceId==='multiscale'));
 const chipped=fixture();chipped.sides.B.roster[0].hp=319;chipped.sides.B.roster[0].passiveEffects=effects('multiscale');const chippedHit=applyDamageHit(chipped,{actorId:'a1',targetId:'b1',move:physical,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(chippedHit.amount>full.amount);assert.ok(!chippedHit.breakdown.passiveModifiers.some(entry=>entry.sourceId==='multiscale'));
 const solid=fixture();solid.sides.B.roster[0].types=['rock'];solid.sides.B.roster[0].passiveEffects=effects('solid-rock');const fighting={id:'fighting-hit',type:'fighting',category:'physical',power:80};solid.sides.A.roster[0].types=['fighting'];const resisted=applyDamageHit(solid,{actorId:'a1',targetId:'b1',move:fighting,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(resisted.effectiveness,2);assert.ok(resisted.breakdown.passiveModifiers.some(entry=>entry.sourceId==='solid-rock'));
});

test('Purifying Salt blocks every major status and halves Ghost damage',()=>{
 for(const status of ['burn','paralysis','poison','sleep','freeze','bad-poison']){const battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('purifying-salt');const result=applyMajorStatus(battle,{actorId:'a1',targetId:'b1',moveId:'salt-test',status},{nextRandom:()=>0});assert.equal(result.events[0].reason,'abilityBlocked',status);}
 const ghost={id:'ghost-hit',type:'ghost',category:'special',power:80},salt=fixture();salt.sides.B.roster[0].types=['psychic'];salt.sides.B.roster[0].passiveEffects=effects('purifying-salt');salt.sides.A.roster[0].types=['ghost'];const reduced=applyDamageHit(salt,{actorId:'a1',targetId:'b1',move:ghost,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');const plain=fixture();plain.sides.B.roster[0].types=['psychic'];plain.sides.A.roster[0].types=['ghost'];const normal=applyDamageHit(plain,{actorId:'a1',targetId:'b1',move:ghost,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(reduced.amount<normal.amount);assert.ok(reduced.breakdown.passiveModifiers.some(entry=>entry.sourceId==='purifying-salt'));
});

test('Hustle boosts physical Attack while reducing only physical move accuracy',()=>{
 const physical={id:'hustle-hit',type:'normal',category:'physical',power:80},boosted=directDamage({abilityId:'hustle',move:physical}),plain=directDamage({move:physical});assert.ok(boosted.amount>plain.amount);assert.ok(boosted.breakdown.abilityStatModifiers.some(entry=>entry.sourceId==='hustle'));
 const battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('hustle');const miss=resolveMove(battle,action('A','a1','test-physical',targetB),{nextRandom:()=>.45});assert.ok(miss.events.some(event=>event.kind==='moveMissed'&&event.effectiveAccuracy===40));
 const specialHit=resolveMove(battle,action('A','a1','test-bullet',targetB),{nextRandom:()=>.45});assert.ok(specialHit.events.some(event=>event.kind==='damage'));
});

test('No Guard forces hits in both directions including semi-invulnerable targets',()=>{
 const attacker=fixture();attacker.sides.A.roster[0].passiveEffects=effects('no-guard');const actorHit=resolveMove(attacker,action('A','a1','test-bullet',targetB),{nextRandom:()=>.999});assert.ok(actorHit.events.some(event=>event.kind==='damage'));
 const target=fixture();target.sides.B.roster[0].passiveEffects=effects('no-guard');const targetHit=resolveMove(target,action('A','a1','test-bullet',targetB),{nextRandom:()=>.999});assert.ok(targetHit.events.some(event=>event.kind==='damage'));
 const semi=fixture();semi.sides.A.roster[0].passiveEffects=effects('no-guard');semi.sides.B.roster[0].volatiles['two-turn-move']={id:'two-turn-move',moveId:'fly',semiInvulnerable:'airborne'};const through=resolveMove(semi,action('A','a1','test-bullet',targetB),{nextRandom:()=>.999});assert.ok(through.events.some(event=>event.kind==='damage'));assert.ok(!through.events.some(event=>event.kind==='moveMissed'&&event.reason==='semiInvulnerable'));
});

test('Guts requires a major status, boosts Attack, and removes the burn physical-damage penalty',()=>{
 const move={id:'guts-hit',type:'normal',category:'physical',power:80},battle=fixture();battle.sides.A.roster[0].status={id:'burn'};battle.sides.A.roster[0].passiveEffects=effects('guts');const guts=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(guts.breakdown.burn,1);assert.ok(guts.breakdown.abilityStatModifiers.some(entry=>entry.sourceId==='guts'));
 const burned=fixture();burned.sides.A.roster[0].status={id:'burn'};const burnedDamage=applyDamageHit(burned,{actorId:'a1',targetId:'b1',move,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(burnedDamage.breakdown.burn,.5);assert.ok(guts.amount>burnedDamage.amount);
 const healthy=directDamage({abilityId:'guts',move});assert.ok(!healthy.breakdown.abilityStatModifiers.some(entry=>entry.sourceId==='guts'));
});

test('r3-ability-hooks-wave4: stat-drop immunity blocks opponent drops across primary, secondary, and protection retaliation but not self drops',()=>{
 for(const [abilityId,stat,blocked] of [['clear-body','atk',true],['white-smoke','spd',true],['hyper-cutter','atk',true],['hyper-cutter','def',false],['big-pecks','def',true]]){
  let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects(abilityId);
  const result=applyStatStagesHandler.run({battle,payload:{action:{...action('A','a1','test-physical',targetB)},move:moveMap['test-physical'],mechanics:{targetMode:'anyAdjacent'},accuracyResolved:true,resolvedTargetIds:['b1'],hitTargetIds:['b1']},params:{boosts:{[stat]:-1}}});
  assert.equal(result.battle.sides.B.roster[0].stages[stat],blocked?0:-1,`${abilityId}:${stat}`);assert.equal(result.events.some(event=>event.kind==='statStageBlocked'),blocked);
 }
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('clear-body');let secondary=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'secondary-drop',effects:[{kind:'stat-stages',chance:100,boosts:{spa:-1}}]});assert.equal(secondary.battle.sides.B.roster[0].stages.spa,0);assert.ok(secondary.events.some(event=>event.kind==='statStageBlocked'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('clear-body');battle.sides.B.roster[0].volatiles.protect={id:'protect',sourceId:'kings-shield',retaliation:'lower-attack',blocksStatus:true};const retaliation=resolveProtectionBlock(battle,{targetRef:{side:'B',slot:0,actorId:'b1'},actorId:'a1',move:moveMap['test-physical'],mechanics:{contact:true}},{nextRandom:()=>0});assert.equal(retaliation.battle.sides.A.roster[0].stages.atk,0);assert.ok(retaliation.events.some(event=>event.kind==='statStageBlocked'));
 battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('clear-body');const self=applyStatStagesHandler.run({battle,payload:{action:{...action('A','a1','test-physical',targetB)},move:moveMap['test-physical'],mechanics:{targetMode:'self'},accuracyResolved:false},params:{target:'self',boosts:{def:-1}}});assert.equal(self.battle.sides.A.roster[0].stages.def,-1);
});

test('r3-ability-hooks-wave4: Quick Feet and Surge Surfer use the shared battle Speed pipeline',()=>{
 let battle=fixture();let actor=battle.sides.A.roster[0];actor.status={id:'burn'};actor.passiveEffects=effects('quick-feet');assert.equal(effectiveBattleSpeed(battle,actor),150);
 actor.status={id:'paralysis'};assert.equal(effectiveBattleSpeed(battle,actor),150,'Quick Feet bypasses the paralysis Speed penalty while statused');
 battle=fixture();actor=battle.sides.A.roster[0];actor.passiveEffects=effects('surge-surfer');battle.field.terrain={id:'electric',remaining:5};assert.equal(effectiveBattleSpeed(battle,actor),200);delete battle.field.terrain;assert.equal(effectiveBattleSpeed(battle,actor),100);
});

test('r3-ability-hooks-wave4: Plus and Minus boost SpA only while a matching active ally is present',()=>{
 const move={id:'plus-hit',type:'normal',category:'special',power:80};let battle=fixture('double');battle.sides.A.roster[0].passiveEffects=effects('plus');battle.sides.A.roster[1].passiveEffects=effects('minus');const boosted=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');
 const plainBattle=fixture('double');plainBattle.sides.A.roster[0].passiveEffects=effects('plus');const plain=applyDamageHit(plainBattle,{actorId:'a1',targetId:'b1',move,mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(boosted.amount>plain.amount);assert.ok(boosted.breakdown.abilityStatModifiers.some(entry=>entry.sourceId==='plus'));
});

test('r3-ability-hooks-wave4: Telepathy blocks ally damage while Friend Guard reduces only ally-received foe damage',()=>{
 let battle=fixture('double');battle.sides.A.roster[1].passiveEffects=effects('telepathy');const block=resolveTargetAbilityBlock(battle,{actorId:'a1',targetId:'a2',move:moveMap['test-physical'],mechanics:{tags:[]}});assert.equal(block.blocked,true);assert.ok(block.events.some(event=>event.abilityId==='telepathy'));
 const foeTry=resolveTargetAbilityBlock(battle,{actorId:'b1',targetId:'a2',move:moveMap['test-physical'],mechanics:{tags:[]}});assert.equal(foeTry.blocked,false);
 battle=fixture('double');battle.sides.B.roster[1].passiveEffects=effects('friend-guard');const guarded=applyDamageHit(battle,{actorId:'a1',targetId:'b1',move:moveMap['test-physical'],mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');const plainBattle=fixture('double');const plain=applyDamageHit(plainBattle,{actorId:'a1',targetId:'b1',move:moveMap['test-physical'],mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.ok(guarded.amount<plain.amount);assert.ok(guarded.breakdown.passiveModifiers.some(entry=>entry.sourceId==='friend-guard'));
 const selfGuard=fixture('double');selfGuard.sides.B.roster[0].passiveEffects=effects('friend-guard');const selfDamage=applyDamageHit(selfGuard,{actorId:'a1',targetId:'b1',move:moveMap['test-physical'],mechanics:{tags:[]}},seeded).events.find(event=>event.kind==='damage');assert.equal(selfDamage.amount,plain.amount);
});

test('r3-ability-hooks-wave4: Shield Dust blocks move secondaries and King\'s Rock-added flinch before RNG',()=>{
 let battle=fixture();battle.sides.B.roster[0].passiveEffects=effects('shield-dust');let randomCalls=0;const result=applySecondaryEffects(battle,{actorId:'a1',targetIds:['b1'],moveId:'secondary-test',effects:[{kind:'volatile-status',volatile:'flinch',chance:50}]},{nextRandom(){randomCalls++;return 0;}});assert.equal(randomCalls,0);assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.ok(result.events.some(event=>event.kind==='secondaryEffectBlocked'));
 battle=fixture();const actor=battle.sides.A.roster[0];actor.buildSnapshot={itemId:'kings-rock',moveIds:['test-physical']};actor.itemState=createHeldItemState('kings-rock');actor.passiveEffects=compilePassiveEffects({itemId:'kings-rock',manifests});battle.sides.B.roster[0].passiveEffects=effects('shield-dust');randomCalls=0;const item=resolveFlinchItems(battle,{actorId:'a1',move:moveMap['test-physical'],mechanics:{secondaryEffects:[]},damagedTargetIds:['b1']},{nextRandom(){randomCalls++;return 0;}});assert.equal(randomCalls,0);assert.equal(item.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.ok(item.events.some(event=>event.kind==='secondaryEffectBlocked'&&event.itemId==='kings-rock'));
});

test('r3-ability-hooks-wave4: Skill Link maximizes ranged multihit moves',()=>{
 let battle=fixture();battle.sides.A.roster[0].passiveEffects=effects('skill-link');battle.sides.A.roster[0].pp['bullet-seed']=10;const result=resolveMove(battle,action('A','a1','bullet-seed',targetB),{nextRandom:()=>.999});const count=result.events.find(event=>event.kind==='hitCount');assert.equal(count.plannedHits,5);assert.equal(count.hitCount,5);
});

test('r3-ability-hooks-wave4: Hydration cures major status in rain before status residual damage and stays dormant otherwise',()=>{
 let battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'rain',remaining:5};battle.sides.A.roster[0].status={id:'poison'};battle.sides.A.roster[0].passiveEffects=effects('hydration');const cured=resolveMechanicsEndTurn(battle);assert.equal(cured.battle.sides.A.roster[0].status,null);assert.equal(cured.battle.sides.A.roster[0].hp,320);assert.ok(cured.events.some(event=>event.kind==='statusCured'&&event.abilityId==='hydration'));
 battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'sun',remaining:5};battle.sides.A.roster[0].status={id:'poison'};battle.sides.A.roster[0].passiveEffects=effects('hydration');const dormant=resolveMechanicsEndTurn(battle);assert.notEqual(dormant.battle.sides.A.roster[0].status,null);assert.ok(dormant.battle.sides.A.roster[0].hp<320);
});

for(const format of ['single','double'])test(`r3-ability-hooks-wave4:${format}`,()=>{
 const ids=['clear-body','white-smoke','hyper-cutter','big-pecks','quick-feet','surge-surfer','plus','minus','telepathy','friend-guard','shield-dust','skill-link','hydration'];
 const battle=fixture(format);for(const id of ids){const compiled=effects(id);assert.ok(compiled.length>0,id);assert.ok(compiled.every(effect=>effect.sourceKind==='ability'&&effect.sourceId===id),id);}
 assert.equal(battle.format,format);
});
