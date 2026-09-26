import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityPowerModifiers,modifyMoveByAbility,variableMovePower} from '../mechanics-v3/index.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {loadMegaBetaCatalog} from '../server/v3-mega-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const promoted=[
 ['abomasnow','abomasnow-mega','abomasite',['grass','ice'],'snow-warning',2.7,185],
 ['absol','absol-mega','absolite',['dark'],'magic-bounce',1.2,49],
 ['altaria','altaria-mega','altarianite',['dragon','fairy'],'pixilate',1.5,20.6],
 ['audino','audino-mega','audinite',['normal','fairy'],'healer',1.5,32],
 ['banette','banette-mega','banettite',['ghost'],'prankster',1.2,13],
 ['gallade','gallade-mega','galladite',['psychic','fighting'],'inner-focus',1.6,56.4],
 ['gardevoir','gardevoir-mega','gardevoirite',['psychic','fairy'],'pixilate',1.6,48.4],
 ['glalie','glalie-mega','glalitite',['ice'],'refrigerate',2.1,350.2],
 ['houndoom','houndoom-mega','houndoominite',['dark','fire'],'solar-power',1.9,49.5],
 ['lucario','lucario-mega','lucarionite',['fighting','steel'],'adaptability',1.3,57.5],
];
const basePhysical=new Map([
 ['abomasnow',[2.2,135.5]],['absol',[1.2,47]],['altaria',[1.1,20.6]],['audino',[1.1,31]],['banette',[1.1,12.5]],
 ['gallade',[1.6,52]],['gardevoir',[1.6,48.4]],['glalie',[1.5,256.5]],['houndoom',[1.4,35]],['lucario',[1.2,54]],
]);

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
 const mon={monId:`mega-wave6-mon-${speciesId}`,speciesId,ownership:'permanent'};
 const build={buildId:`mega-wave6-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(build);
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave6-${speciesId}-${mode}`,mode,seed:8306,playerBuildIds,progression,catalog:v3Catalog});
}

for(const mode of ['single','double'])test(`r6-mega-wave6:${mode} promotes ten vertically-complete Mega pairs with explicit physical foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],baseExpected=basePhysical.get(base);
  assert.equal(unit.heightM,baseExpected[0],`${base} base height`);assert.equal(unit.weightKg,baseExpected[1],`${base} base weight`);
  const valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.activeAbilityId,abilityId);assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);
  assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.toSpeciesId===megaId&&event.heightM===heightM&&event.weightKg===weightKg));
 }
});

test('Wave 6 Mega abilities reuse shared type conversion and passive contracts',()=>{
 for(const [base,stone,type,sourceId] of [['altaria','altarianite','fairy','pixilate'],['gardevoir','gardevoirite','fairy','pixilate'],['glalie','glalitite','ice','refrigerate']]){
  const battle=applyMegaEvolution(battleFor(base,stone),{side:'A',actorId:'A-0'},v3Catalog).battle,actor=battle.sides.A.roster[0],normal=v3Catalog.movesById['body-slam'];
  const converted=modifyMoveByAbility(actor,normal,normal.mechanics);assert.equal(converted.move.type,type,base);assert.equal(converted.mechanics.abilityTypeConversion?.sourceId,sourceId,base);
  const power=abilityPowerModifiers(actor,converted.move,converted.mechanics,{battle,target:battle.sides.B.roster[0]});assert.equal(power.apply(normal.power),Math.floor(normal.power*1.2),base);assert.ok(power.applied.some(entry=>entry.sourceId===sourceId&&entry.multiplier===1.2),base);
 }
 const expectedEffects=new Map([
  ['absol',['magic-bounce','status-move-reflect']],['audino',['healer','end-turn-ally-status-cure']],['banette',['prankster','turn-order-modifier']],['houndoom',['solar-power','weather-stat-boost']],['lucario',['adaptability','stab-modifier']],
 ]);
 for(const [base,[abilityId,kind]] of expectedEffects){const stone=promoted.find(row=>row[0]===base)[2],mega=applyMegaEvolution(battleFor(base,stone),{side:'A',actorId:'A-0'},v3Catalog).battle.sides.A.roster[0];assert.equal(mega.activeAbilityId,abilityId);assert.ok(mega.passiveEffects.some(effect=>effect.sourceId===abilityId&&effect.kind===kind),`${base}:${kind}`);}
});

test('Mega Abomasnow activates Snow Warning during the Mega phase',()=>{
 const result=applyMegaEvolution(battleFor('abomasnow','abomasite'),{side:'A',actorId:'A-0'},v3Catalog);assert.equal(result.battle.field.weather?.id,'snow');assert.ok(result.events.some(event=>event.kind==='weatherStarted'&&event.sourceAbilityId==='snow-warning'));
});

test('Mega Abomasnow and Mega Glalie use reviewed Mega weights for Heavy Slam tiers',()=>{
 for(const [base,stone,targetWeight,baseWeight,megaWeight] of [['abomasnow','abomasite',30,135.5,185],['glalie','glalitite',60,256.5,350.2]]){
  const before=battleFor(base,stone),actor=before.sides.A.roster[0],target=before.sides.B.roster[0];target.weightKg=targetWeight;assert.equal(actor.weightKg,baseWeight);assert.equal(variableMovePower('user-target-weight-ratio',{battle:before,actor,target,basePower:40}),100,`${base} base tier`);
  const after=applyMegaEvolution(before,{side:'A',actorId:actor.actorId},v3Catalog).battle,mega=after.sides.A.roster[0],afterTarget=after.sides.B.roster[0];afterTarget.weightKg=targetWeight;assert.equal(mega.weightKg,megaWeight);assert.equal(variableMovePower('user-target-weight-ratio',{battle:after,actor:mega,target:afterTarget,basePower:40}),120,`${base} Mega tier`);
 }
});

test('Wave 6 M-A forms remain present while alternate Z branches stay source-retained for M-C only',()=>{
 assert.ok(v3Catalog.megaForms.length>=29);assert.ok(v3Catalog.megaRelations.length>=29);
 for(const [base,megaId,stone] of promoted){assert.ok(v3Catalog.speciesById[base],base);assert.ok(v3Catalog.speciesById[megaId],megaId);assert.ok(v3Catalog.megaRelations.some(relation=>relation.baseSpeciesId===base&&relation.megaSpeciesId===megaId&&relation.itemId===stone),stone);}
 const source=loadMegaBetaCatalog();for(const megaId of ['absol-mega-z','lucario-mega-z']){assert.equal(v3Catalog.speciesById[megaId],undefined);assert.deepEqual(source.relations.find(relation=>relation.megaSpeciesId===megaId)?.regulationSets,['m-c']);}
});
