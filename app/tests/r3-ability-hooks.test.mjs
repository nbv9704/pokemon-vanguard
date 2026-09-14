import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 applyDamageHit,applyMajorStatus,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,
 modifyMoveByAbility,resolveMechanicsEndTurn,resolveTargetAbilityBlock,scheduleDelayedEffect
} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const moveMap=Object.fromEntries(allMoves.filter(move=>['bullet-seed','drain-punch','hyper-voice','yawn'].includes(move.id)).map(move=>[move.id,move]));
moveMap['test-fire']={id:'test-fire',name:'Test Fire',type:'fire',category:'special',power:80,accuracy:100,maxPP:16};
moveMap['test-bullet']={id:'test-bullet',name:'Test Bullet',type:'normal',category:'special',power:50,accuracy:50,maxPP:16};
const localManifests=structuredClone(manifests.moves);
for(const [id,tags=[]] of [['test-fire',[]],['test-bullet',['bullet']]])localManifests[id]={id,targetMode:'adjacentFoe',priority:0,contact:false,tags,handlers:[{id:'spend-pp',hook:'onTryMove',order:10},{id:'check-accuracy',hook:'onMove',order:90},{id:'deal-direct-damage',hook:'onMove',order:100}],testEvidence:{single:['r3-ability-hooks:single'],double:['r3-ability-hooks:double']}};
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
