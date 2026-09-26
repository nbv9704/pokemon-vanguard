import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDamageHit,resolveTargetAbilityBlock} from '../mechanics-v3/index.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3BattleSnapshot} from '../server/v3-battle-view.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const promoted=[
 ['blastoise','blastoise-mega','blastoisinite',['water'],'mega-launcher',101.1],
 ['beedrill','beedrill-mega','beedrillite',['bug','poison'],'adaptability',40.5],
 ['charizard','charizard-mega-x','charizardite-x',['fire','dragon'],'tough-claws',110.5],
 ['charizard','charizard-mega-y','charizardite-y',['fire','flying'],'drought',100.5],
 ['chesnaught','chesnaught-mega','chesnaughtite',['grass','fighting'],'bulletproof',90],
 ['scizor','scizor-mega','scizorite',['bug','steel'],'technician',125]
];

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog);
 let mon=progression.mons.find(entry=>entry.speciesId===speciesId),build=mon&&progression.builds.find(entry=>entry.monId===mon.monId);
 if(!build){
  const species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
  mon={monId:`mega-wave2-mon-${speciesId}`,speciesId,ownership:'permanent'};
  build={buildId:`mega-wave2-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};
  progression.mons.push(mon);progression.builds.push(build);
 }
 build.itemId=itemId;
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave2-${speciesId}-${mode}`,mode,seed:7802,playerBuildIds,progression,catalog:v3Catalog});
}

for(const mode of ['single','double'])test(`r6-mega-wave2:${mode} promotes every active-roster Mega relation with form foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.activeAbilityId,abilityId);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);assert.equal(result.battle.megaUsed.A,1);assert.equal(result.events[0].kind,'megaEvolved');
 }
});

test('Mega Charizard Y starts Drought immediately during the Mega phase',()=>{
 const battle=battleFor('charizard','charizardite-y'),result=applyMegaEvolution(battle,{side:'A',actorId:'A-0'},v3Catalog);
 assert.equal(result.battle.field.weather?.id,'sun');assert.equal(result.battle.field.weather?.remaining,5);
 const mega=result.events.findIndex(event=>event.kind==='megaEvolved'),trigger=result.events.findIndex(event=>event.kind==='abilityTriggered'&&event.abilityId==='drought'),weather=result.events.findIndex(event=>event.kind==='weatherStarted'&&event.weather==='sun');
 assert.ok(mega===0&&trigger>mega&&weather>trigger);assert.equal(result.events[weather].trigger,'mega-evolution');
});

test('Mega Blastoise uses refreshed pulse tags so Mega Launcher boosts Water Pulse',()=>{
 const battle=applyMegaEvolution(battleFor('blastoise','blastoisinite'),{side:'A',actorId:'A-0'},v3Catalog).battle,move=v3Catalog.movesById['water-pulse'],runtime={nextRandom:()=>.999};assert.ok(move.mechanics.tags.includes('pulse'));
 const boosted=applyDamageHit(battle,{actorId:'A-0',targetId:'B-0',move,mechanics:move.mechanics},runtime).events.find(event=>event.kind==='damage'),plain=structuredClone(battle);plain.sides.A.roster[0].passiveEffects=plain.sides.A.roster[0].passiveEffects.filter(effect=>effect.sourceKind!=='ability');const normal=applyDamageHit(plain,{actorId:'A-0',targetId:'B-0',move,mechanics:move.mechanics},runtime).events.find(event=>event.kind==='damage');
 assert.ok(boosted.amount>normal.amount);assert.ok(boosted.breakdown.abilityPowerModifiers.some(entry=>entry.sourceId==='mega-launcher'&&entry.multiplier===1.5));
});

test('promoted Mega abilities compile into the actual transformed unit',()=>{
 for(const [base,,stone,,abilityId] of promoted){const mega=applyMegaEvolution(battleFor(base,stone),{side:'A',actorId:'A-0'},v3Catalog).battle.sides.A.roster[0];assert.ok(mega.passiveEffects.some(effect=>effect.sourceKind==='ability'&&effect.sourceId===abilityId),abilityId);}
 const chesnaught=applyMegaEvolution(battleFor('chesnaught','chesnaughtite'),{side:'A',actorId:'A-0'},v3Catalog).battle,blocked=resolveTargetAbilityBlock(chesnaught,{actorId:'B-0',targetId:'A-0',move:{id:'test-bomb',type:'grass',category:'special',power:80},mechanics:{tags:['bullet']}});assert.equal(blocked.blocked,true);assert.ok(blocked.events.some(event=>event.abilityId==='bulletproof'));
});

test('battle projection exposes Mega state and honors explicit sprite fallback without leaking mechanics',()=>{
 assert.equal(new Set(v3Catalog.abilities.map(entry=>entry.id)).size,v3Catalog.abilities.length);assert.equal(new Set(v3Catalog.items.map(entry=>entry.id)).size,v3Catalog.items.length);
 const result=applyMegaEvolution(battleFor('blastoise','blastoisinite'),{side:'A',actorId:'A-0'},v3Catalog),snapshot=v3BattleSnapshot(result.battle),own=snapshot.own[0];assert.equal(own.speciesId,'blastoise-mega');assert.equal(own.spriteKey,'blastoise-mega');assert.equal(own.megaEvolved,true);
 const mirrored=structuredClone(result.battle);mirrored.sides.B.roster[0]={...structuredClone(result.battle.sides.A.roster[0]),actorId:'B-0'};mirrored.sides.B.active=['B-0'];const opponent=v3BattleSnapshot(mirrored).opponent[0];assert.equal(opponent.speciesId,'blastoise-mega');assert.equal(opponent.spriteKey,'blastoise-mega');assert.equal(opponent.megaEvolved,true);assert.equal(opponent.passiveEffects,undefined);
});
