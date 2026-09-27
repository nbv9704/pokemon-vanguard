import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyDamageHit,applyWeather,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,resolveMechanicsEndTurn,speedWithWeather,weatherDamageModifier} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const allMoves=JSON.parse(await readFile(new URL('../content-validation/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const moves=Object.fromEntries(allMoves.filter(move=>['sunny-day','rain-dance','sandstorm','snowscape'].includes(move.id)).map(move=>[move.id,move]));
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const unit=(actorId,overrides={})=>({actorId,types:['normal'],hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:{'sunny-day':8,'rain-dance':8,'sandstorm':16,'snowscape':16},status:null,volatiles:{},stages:stages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const count=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`weather-${format}`,format,level:50,phase:'RESOLVE',turn:1,activeCount:count,rngState:1,field:{},sides:{A:{active:a.slice(0,count).map(entry=>entry.actorId),roster:a,conditions:{}},B:{active:b.slice(0,count).map(entry=>entry.actorId),roster:b,conditions:{}}}};
}
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)});

test('r3-weather:single weather moves set five turns and held rocks extend only their weather',()=>{
 const base=fixture(),before=structuredClone(base),sun=resolveMove(base,{kind:'move',side:'A',actorId:'a1',moveId:'sunny-day'},{});
 assert.deepEqual(base,before);assert.deepEqual(sun.battle.field.weather,{id:'sun',remaining:5,sourceActorId:'a1',sourceMoveId:'sunny-day'});assert.equal(sun.battle.sides.A.roster[0].pp['sunny-day'],7);
 const holder=fixture();holder.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'heat-rock',manifests});
 const extended=resolveMove(holder,{kind:'move',side:'A',actorId:'a1',moveId:'sunny-day'},{});assert.equal(extended.battle.field.weather.remaining,8);assert.equal(extended.events.at(-1).sourceItemId,'heat-rock');
 const wrongRock=fixture();wrongRock.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'damp-rock',manifests});
 assert.equal(resolveMove(wrongRock,{kind:'move',side:'A',actorId:'a1',moveId:'sunny-day'},{}).battle.field.weather.remaining,5);
});

test('sun and rain apply the reviewed Fire and Water damage modifiers',()=>{
 const fire={id:'fire-hit',type:'fire',category:'special',power:80},water={...fire,id:'water-hit',type:'water'},runtime={nextRandom:()=>.999};
 const damage=(weather,move)=>{const battle=fixture();battle.field.weather=weather?{id:weather,remaining:4}:null;battle.sides.A.roster[0].types=[move.type];return applyDamageHit(battle,{actorId:'a1',targetId:'b1',move},runtime).events[0];};
 assert.equal(weatherDamageModifier({field:{weather:{id:'sun'}}},'fire'),1.5);assert.equal(weatherDamageModifier({field:{weather:{id:'sun'}}},'water'),.5);
 assert.equal(damage('sun',fire).breakdown.weather,1.5);assert.equal(damage('rain',fire).breakdown.weather,.5);assert.equal(damage('rain',water).breakdown.weather,1.5);assert.equal(damage('sun',water).breakdown.weather,.5);
 assert.ok(damage('sun',fire).amount>damage(null,fire).amount);assert.ok(damage('rain',fire).amount<damage(null,fire).amount);
});

test('weather Speed abilities are active only in their matching condition',()=>{
 const chlorophyll=unit('a1',{passiveEffects:compilePassiveEffects({abilityId:'chlorophyll',manifests})}),swimmer=unit('b1',{passiveEffects:compilePassiveEffects({abilityId:'swift-swim',manifests})});
 assert.equal(speedWithWeather(101,chlorophyll,{field:{weather:{id:'sun'}}}),202);assert.equal(speedWithWeather(101,chlorophyll,{field:{weather:{id:'rain'}}}),101);assert.equal(speedWithWeather(99,swimmer,{field:{weather:{id:'rain'}}}),198);
});

test('Rain Dish heals active holders before weather expires at end of turn',()=>{
 const battle=fixture();battle.phase='END_TURN';battle.field.weather={id:'rain',remaining:1};battle.sides.A.roster[0].hp=140;battle.sides.A.roster[0].passiveEffects=compilePassiveEffects({abilityId:'rain-dish',manifests});
 const result=resolveMechanicsEndTurn(battle),heal=result.events.find(event=>event.kind==='heal'),ended=result.events.find(event=>event.kind==='weatherEnded');
 assert.equal(heal.amount,10);assert.equal(result.battle.sides.A.roster[0].hp,150);assert.equal(ended.weather,'rain');assert.equal(result.battle.field.weather,undefined);assert.equal(result.battle.turn,2);
});

test('r3-weather:double one field condition affects both sides and resets its duration',()=>{
 const battle=fixture('double');battle.field.weather={id:'sun',remaining:2};battle.sides.B.roster[0].passiveEffects=compilePassiveEffects({itemId:'damp-rock',manifests});
 const result=resolveMove(battle,{kind:'move',side:'B',actorId:'b1',moveId:'rain-dance'},{});
 assert.deepEqual(result.battle.field.weather,{id:'rain',remaining:8,sourceActorId:'b1',sourceMoveId:'rain-dance'});assert.equal(result.events.at(-1).weather,'rain');
 const direct=applyWeather(result.battle,{actorId:'a1',moveId:'sunny-day',weather:'sun'});assert.equal(direct.battle.field.weather.id,'sun');assert.equal(result.battle.field.weather.id,'rain');
});


test('Snow and Sandstorm use shared duration rocks plus canonical defensive field modifiers',()=>{
 const snow=fixture();snow.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'icy-rock',manifests});
 const snowed=resolveMove(snow,{kind:'move',side:'A',actorId:'a1',moveId:'snowscape'},{});assert.equal(snowed.battle.field.weather.id,'snow');assert.equal(snowed.battle.field.weather.remaining,8);assert.equal(snowed.events.at(-1).sourceItemId,'icy-rock');
 const sand=fixture();sand.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'smooth-rock',manifests});
 const sanded=resolveMove(sand,{kind:'move',side:'A',actorId:'a1',moveId:'sandstorm'},{});assert.equal(sanded.battle.field.weather.id,'sandstorm');assert.equal(sanded.battle.field.weather.remaining,8);assert.equal(sanded.events.at(-1).sourceItemId,'smooth-rock');
 const physical={id:'physical-hit',type:'normal',category:'physical',power:90},special={id:'special-hit',type:'water',category:'special',power:90},runtime={nextRandom:()=>.999};
 const plainIce=fixture();plainIce.sides.B.roster[0].types=['ice'];const snowIce=structuredClone(plainIce);snowIce.field.weather={id:'snow',remaining:5};
 const plainPhysical=applyDamageHit(plainIce,{actorId:'a1',targetId:'b1',move:physical},runtime).events.find(event=>event.kind==='damage'),snowPhysical=applyDamageHit(snowIce,{actorId:'a1',targetId:'b1',move:physical},runtime).events.find(event=>event.kind==='damage');assert.ok(snowPhysical.amount<plainPhysical.amount);assert.equal(snowPhysical.breakdown.weatherDefenseModifier.weather,'snow');assert.equal(snowPhysical.breakdown.weatherDefenseModifier.stat,'def');
 const plainRock=fixture();plainRock.sides.B.roster[0].types=['rock'];const sandRock=structuredClone(plainRock);sandRock.field.weather={id:'sandstorm',remaining:5};
 const plainSpecial=applyDamageHit(plainRock,{actorId:'a1',targetId:'b1',move:special},runtime).events.find(event=>event.kind==='damage'),sandSpecial=applyDamageHit(sandRock,{actorId:'a1',targetId:'b1',move:special},runtime).events.find(event=>event.kind==='damage');assert.ok(sandSpecial.amount<plainSpecial.amount);assert.equal(sandSpecial.breakdown.weatherDefenseModifier.weather,'sandstorm');assert.equal(sandSpecial.breakdown.weatherDefenseModifier.stat,'spd');
});

test('Sandstorm residual damages only non Rock/Ground/Steel active units and ticks before expiry',()=>{
 const battle=fixture('double');battle.phase='END_TURN';battle.field.weather={id:'sandstorm',remaining:1};battle.sides.A.roster[0].types=['normal'];battle.sides.A.roster[1].types=['rock'];battle.sides.B.roster[0].types=['ground'];battle.sides.B.roster[1].types=['steel'];
 const result=resolveMechanicsEndTurn(battle),weatherDamage=result.events.filter(event=>event.kind==='damage'&&event.source==='weather-residual-damage');assert.deepEqual(weatherDamage.map(event=>event.targetId),['a1']);assert.equal(weatherDamage[0].amount,10);assert.equal(result.battle.field.weather,undefined);assert.ok(result.events.some(event=>event.kind==='weatherEnded'&&event.weather==='sandstorm'));
});
