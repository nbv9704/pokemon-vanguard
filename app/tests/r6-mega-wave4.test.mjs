import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityPowerModifiers,abilityStatModifiers,variableMovePower} from '../mechanics-v3/index.mjs';
import {abilityMaximizesMultiHit} from '../mechanics-v3/ability-hooks.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const promoted=[
 ['steelix','steelix-mega','steelixite',['steel','ground'],'sand-force',10.5,740],
 ['camerupt','camerupt-mega','cameruptite',['fire','ground'],'sheer-force',2.5,320.5],
 ['heracross','heracross-mega','heracronite',['bug','fighting'],'skill-link',1.7,62.5],
 ['medicham','medicham-mega','medichamite',['fighting','psychic'],'pure-power',1.3,31.5],
];

const basePhysical=new Map([
 ['steelix',[9.2,400]],
 ['camerupt',[1.9,220]],
 ['heracross',[1.5,54]],
 ['medicham',[1.3,31.5]],
]);

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
 const mon={monId:`mega-wave4-mon-${speciesId}`,speciesId,ownership:'permanent'};
 const build={buildId:`mega-wave4-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(build);
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave4-${speciesId}-${mode}`,mode,seed:8004,playerBuildIds,progression,catalog:v3Catalog});
}

for(const mode of ['single','double'])test(`r6-mega-wave4:${mode} promotes four Mega-first roster additions with explicit form foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],baseExpected=basePhysical.get(base);
  assert.equal(unit.heightM,baseExpected[0],`${base} base height`);assert.equal(unit.weightKg,baseExpected[1],`${base} base weight`);
  const valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.activeAbilityId,abilityId);assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);
  assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.toSpeciesId===megaId&&event.heightM===heightM&&event.weightKg===weightKg));
 }
});

test('Mega Steelix uses its 740 kg form weight for Heavy Slam tiers rather than inheriting base Steelix weight',()=>{
 const before=battleFor('steelix','steelixite'),base=before.sides.A.roster[0],target=before.sides.B.roster[0];target.weightKg=100;
 assert.equal(base.weightKg,400);assert.equal(variableMovePower('user-target-weight-ratio',{battle:before,actor:base,target,basePower:40}),100);
 const after=applyMegaEvolution(before,{side:'A',actorId:base.actorId},v3Catalog).battle,mega=after.sides.A.roster[0],afterTarget=after.sides.B.roster[0];afterTarget.weightKg=100;
 assert.equal(mega.weightKg,740);assert.equal(variableMovePower('user-target-weight-ratio',{battle:after,actor:mega,target:afterTarget,basePower:40}),120);
});

test('new Mega abilities compile through transformation and reuse shared mechanics contracts',()=>{
 const steelix=applyMegaEvolution(battleFor('steelix','steelixite'),{side:'A',actorId:'A-0'},v3Catalog).battle,megaSteelix=steelix.sides.A.roster[0];steelix.field??={};steelix.field.weather={id:'sandstorm',remaining:4};
 const gyro=v3Catalog.movesById['gyro-ball'],sandBoost=abilityPowerModifiers(megaSteelix,gyro,gyro.mechanics,{battle:steelix,target:steelix.sides.B.roster[0]});assert.ok(sandBoost.applied.some(entry=>entry.sourceId==='sand-force')===false,'Sand Force is a damage modifier, not a base-power modifier');
 assert.ok(megaSteelix.passiveEffects.some(effect=>effect.sourceId==='sand-force'&&effect.kind==='weather-type-damage-boost'));

 const camerupt=applyMegaEvolution(battleFor('camerupt','cameruptite'),{side:'A',actorId:'A-0'},v3Catalog).battle,megaCamerupt=camerupt.sides.A.roster[0],rock=v3Catalog.movesById['rock-slide'];
 const sheer=abilityPowerModifiers(megaCamerupt,rock,rock.mechanics,{battle:camerupt,target:camerupt.sides.B.roster[0]});assert.ok(sheer.applied.some(entry=>entry.sourceId==='sheer-force'&&entry.multiplier>1.3));

 const heracross=applyMegaEvolution(battleFor('heracross','heracronite'),{side:'A',actorId:'A-0'},v3Catalog).battle.sides.A.roster[0];assert.equal(abilityMaximizesMultiHit(heracross),true);
 const medichamBattle=applyMegaEvolution(battleFor('medicham','medichamite'),{side:'A',actorId:'A-0'},v3Catalog).battle,medicham=medichamBattle.sides.A.roster[0],pure=abilityStatModifiers(medicham,'atk',medichamBattle);assert.equal(pure.apply(100),200);assert.ok(pure.applied.some(entry=>entry.sourceId==='pure-power'&&entry.multiplier===2));
});

test('R3-80 Mega catalog keeps explicit physical data for every promoted Mega form',()=>{
 assert.ok(v3Catalog.megaForms.length>=29);
 for(const form of v3Catalog.megaForms){assert.ok(Number(form.heightM)>0,`${form.id} height`);assert.ok(Number(form.weightKg)>0,`${form.id} weight`);}
 for(const [base,megaId] of promoted){assert.ok(v3Catalog.speciesById[base],base);assert.ok(v3Catalog.speciesById[megaId],megaId);}
});
