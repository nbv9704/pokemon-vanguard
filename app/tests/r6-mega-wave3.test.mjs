import test from 'node:test';
import assert from 'node:assert/strict';
import {
 abilityPowerModifiers,
 effectiveWeatherForUnit,
 effectiveWeatherId,
 modifyChargePowerHandler,
 modifyMoveByAbility,
 prepareTwoTurnMoveHandler,
 variableMovePower,
 weatherDamageModifier
} from '../mechanics-v3/index.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const physical=new Map([
 ['venusaur-mega',[2.4,155.5]],
 ['blastoise-mega',[1.6,101.1]],
 ['beedrill-mega',[1.4,40.5]],
 ['charizard-mega-x',[1.7,110.5]],
 ['charizard-mega-y',[1.7,100.5]],
 ['chesnaught-mega',[1.6,90]],
 ['scizor-mega',[2.0,125]],
 ['feraligatr-mega',[2.3,108.8]],
 ['meganium-mega',[2.4,201]],
 ['steelix-mega',[10.5,740]],
 ['camerupt-mega',[2.5,320.5]],
 ['heracross-mega',[1.7,62.5]],
 ['medicham-mega',[1.3,31.5]],
 ['alakazam-mega',[1.2,48]],
 ['aerodactyl-mega',[2.1,79]],
 ['garchomp-mega',[1.9,95]],
 ['gyarados-mega',[6.5,305]],
 ['ampharos-mega',[1.4,61.5]],
 ['manectric-mega',[1.8,44]],
 ['abomasnow-mega',[2.7,185]],
 ['absol-mega',[1.2,49]],
 ['altaria-mega',[1.5,20.6]],
 ['audino-mega',[1.5,32]],
 ['banette-mega',[1.2,13]],
 ['gallade-mega',[1.6,56.4]],
 ['gardevoir-mega',[1.6,48.4]],
 ['glalie-mega',[2.1,350.2]],
 ['houndoom-mega',[1.9,49.5]],
 ['lucario-mega',[1.3,57.5]],
]);

const promoted=[
 ['feraligatr','feraligatr-mega','feraligite',['water','dragon'],'dragonize',2.3,108.8],
 ['meganium','meganium-mega','meganiumite',['grass','fairy'],'mega-sol',2.4,201],
];

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog);
 let mon=progression.mons.find(entry=>entry.speciesId===speciesId),build=mon&&progression.builds.find(entry=>entry.monId===mon.monId);
 if(!build){
  const species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
  mon={monId:`mega-wave3-mon-${speciesId}`,speciesId,ownership:'permanent'};
  build={buildId:`mega-wave3-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:defaults.itemId,revision:1};
  progression.mons.push(mon);progression.builds.push(build);
 }
 build.itemId=itemId;
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave3-${speciesId}-${mode}`,mode,seed:7903,playerBuildIds,progression,catalog:v3Catalog});
}

for(const mode of ['single','double'])test(`r6-mega-wave3:${mode} promotes Feraligatr and Meganium with explicit form foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.activeAbilityId,abilityId);assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);
  assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.heightM===heightM&&event.weightKg===weightKg));
 }
});

test('every promoted Mega form carries explicit reviewed height and weight in the runtime catalog',()=>{
 assert.ok(v3Catalog.megaForms.length>=physical.size);
 for(const [formId,expected] of physical){
  const form=v3Catalog.speciesById[formId];assert.ok(form,`missing promoted Mega ${formId}`);assert.equal(form.heightM,expected[0],`${form.id} height`);assert.equal(form.weightKg,expected[1],`${form.id} weight`);
 }
 for(const form of v3Catalog.megaForms){assert.ok(Number(form.heightM)>0,`${form.id} height`);assert.ok(Number(form.weightKg)>0,`${form.id} weight`);}
 const broken=structuredClone(v3Catalog),relation=broken.megaRelations.find(entry=>entry.megaSpeciesId==='feraligatr-mega');delete broken.speciesById[relation.megaSpeciesId].weightKg;
 const battle=battleFor('feraligatr','feraligite');assert.deepEqual(validateMegaChoice(battle,{mega:true,side:'A',actorId:'A-0'},broken),{ok:false,code:'MEGA_FOUNDATION_MISSING'});
});

test('Dragonize converts Normal moves to Dragon and applies the 1.2x conversion boost',()=>{
 const battle=applyMegaEvolution(battleFor('feraligatr','feraligite'),{side:'A',actorId:'A-0'},v3Catalog).battle,actor=battle.sides.A.roster[0],body=v3Catalog.movesById['body-slam'];
 const converted=modifyMoveByAbility(actor,body,body.mechanics);assert.equal(converted.move.type,'dragon');assert.equal(converted.mechanics.abilityTypeConversion?.sourceId,'dragonize');
 const power=abilityPowerModifiers(actor,converted.move,converted.mechanics,{battle,target:battle.sides.B.roster[0]});assert.equal(power.apply(body.power),102);assert.deepEqual(power.applied.map(entry=>[entry.sourceId,entry.multiplier]),[['dragonize',1.2]]);
 const water={...body,type:'water'},untouched=modifyMoveByAbility(actor,water,body.mechanics);assert.equal(untouched.move.type,'water');assert.equal(untouched.mechanics.abilityTypeConversion,undefined);
});

test('Mega Sol gives only its active holder personal harsh sunlight without replacing field weather',()=>{
 let battle=applyMegaEvolution(battleFor('meganium','meganiumite'),{side:'A',actorId:'A-0'},v3Catalog).battle;battle=structuredClone(battle);battle.field??={};battle.field.weather={id:'rain',remaining:4,sourceActorId:'B-0'};
 const mega=battle.sides.A.roster[0],foe=battle.sides.B.roster[0];assert.equal(effectiveWeatherId(battle),'rain');assert.equal(effectiveWeatherForUnit(battle,mega),'sun');assert.equal(effectiveWeatherForUnit(battle,foe),'rain');assert.equal(battle.field.weather.id,'rain');
 assert.equal(weatherDamageModifier(battle,'fire',mega),1.5);assert.equal(weatherDamageModifier(battle,'water',mega),0.5);assert.equal(weatherDamageModifier(battle,'fire',foe),0.5);assert.equal(weatherDamageModifier(battle,'water',foe),1.5);
 const solar=v3Catalog.movesById['solar-beam'];mega.pp['solar-beam']=solar.maxPP;
 const payload={action:{actorId:mega.actorId,target:{side:'B',slot:0}},move:structuredClone(solar),mechanics:structuredClone(solar.mechanics)};
 const prep=prepareTwoTurnMoveHandler.run({battle,payload,params:solar.mechanics.handlers.find(entry=>entry.id==='prepare-two-turn-move').params});assert.equal(prep.payload.twoTurnChargeSkipped,true);assert.ok(prep.events.some(event=>event.kind==='twoTurnChargeSkipped'&&event.reason==='sun'));
 const charge=modifyChargePowerHandler.run({battle,payload,params:{rainMultiplier:0.5}});assert.equal(charge.payload.move.power,solar.power);assert.equal(charge.events.length,0);
});

test('Mega Meganium physical foundation changes weight-tier mechanics at the 200 kg boundary',()=>{
 const before=battleFor('meganium','meganiumite'),base=before.sides.A.roster[0],attacker=before.sides.B.roster[0];assert.equal(base.heightM,1.8);assert.equal(base.weightKg,100.5);assert.equal(variableMovePower('target-weight-tier',{battle:before,actor:attacker,target:base,basePower:20}),100);
 const after=applyMegaEvolution(before,{side:'A',actorId:'A-0'},v3Catalog).battle,mega=after.sides.A.roster[0];assert.equal(mega.heightM,2.4);assert.equal(mega.weightKg,201);assert.equal(variableMovePower('target-weight-tier',{battle:after,actor:attacker,target:mega,basePower:20}),120);
});
