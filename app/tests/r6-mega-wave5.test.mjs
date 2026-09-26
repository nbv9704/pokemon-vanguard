import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityPowerModifiers,variableMovePower} from '../mechanics-v3/index.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {loadMegaBetaCatalog} from '../server/v3-mega-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const promoted=[
 ['alakazam','alakazam-mega','alakazite',['psychic'],'trace',1.2,48],
 ['aerodactyl','aerodactyl-mega','aerodactylite',['rock','flying'],'tough-claws',2.1,79],
 ['garchomp','garchomp-mega','garchompite',['dragon','ground'],'sand-force',1.9,95],
 ['gyarados','gyarados-mega','gyaradosite',['water','dark'],'mold-breaker',6.5,305],
 ['ampharos','ampharos-mega','ampharosite',['electric','dragon'],'mold-breaker',1.4,61.5],
 ['manectric','manectric-mega','manectite',['electric'],'intimidate',1.8,44],
];
const basePhysical=new Map([
 ['alakazam',[1.5,48]],['aerodactyl',[1.8,59]],['garchomp',[1.9,95]],['gyarados',[6.5,235]],['ampharos',[1.4,61.5]],['manectric',[1.5,40.2]],
]);

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
 const mon={monId:`mega-wave5-mon-${speciesId}`,speciesId,ownership:'permanent'};
 const build={buildId:`mega-wave5-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(build);
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave5-${speciesId}-${mode}`,mode,seed:8205,playerBuildIds,progression,catalog:v3Catalog});
}

for(const mode of ['single','double'])test(`r6-mega-wave5:${mode} promotes six content-complete Mega-first species with explicit physical foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],baseExpected=basePhysical.get(base);
  assert.equal(unit.heightM,baseExpected[0],`${base} base height`);assert.equal(unit.weightKg,baseExpected[1],`${base} base weight`);
  const valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);
  if(!['trace','intimidate'].includes(abilityId))assert.equal(mega.activeAbilityId,abilityId);
  assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.toSpeciesId===megaId&&event.heightM===heightM&&event.weightKg===weightKg));
 }
});

test('Mega Aerodactyl Tough Claws and Mega Garchomp Sand Force reuse generic ability contracts',()=>{
 const aeroBattle=applyMegaEvolution(battleFor('aerodactyl','aerodactylite'),{side:'A',actorId:'A-0'},v3Catalog).battle,aero=aeroBattle.sides.A.roster[0],bite=v3Catalog.movesById.bite;
 const contact=abilityPowerModifiers(aero,bite,bite.mechanics,{battle:aeroBattle,target:aeroBattle.sides.B.roster[0]});assert.ok(contact.applied.some(entry=>entry.sourceId==='tough-claws'&&entry.multiplier>1.3));
 const chompBattle=applyMegaEvolution(battleFor('garchomp','garchompite'),{side:'A',actorId:'A-0'},v3Catalog).battle,chomp=chompBattle.sides.A.roster[0];assert.equal(chomp.activeAbilityId,'sand-force');assert.ok(chomp.passiveEffects.some(effect=>effect.sourceId==='sand-force'&&effect.kind==='weather-type-damage-boost'));
});

test('Mega Manectric activates Intimidate during Mega Evolution and Mega Alakazam resolves Trace at Mega time',()=>{
 const manectricBefore=battleFor('manectric','manectite'),foeBefore=manectricBefore.sides.B.roster.find(entry=>manectricBefore.sides.B.active.includes(entry.actorId)),atkBefore=foeBefore.stages?.atk||0;
 const manectricResult=applyMegaEvolution(manectricBefore,{side:'A',actorId:'A-0'},v3Catalog),foeAfter=manectricResult.battle.sides.B.roster.find(entry=>manectricResult.battle.sides.B.active.includes(entry.actorId));
 assert.equal(manectricResult.battle.sides.A.roster[0].activeAbilityId,'intimidate');assert.equal(foeAfter.stages.atk,atkBefore-1);assert.ok(manectricResult.events.some(event=>event.kind==='statStageChanged'&&event.abilityId==='intimidate'&&event.trigger==='mega-evolution'));

 const alakazamBefore=battleFor('alakazam','alakazite'),target=alakazamBefore.sides.B.roster.find(entry=>alakazamBefore.sides.B.active.includes(entry.actorId)),expectedAbility=target.activeAbilityId;
 const alakazamResult=applyMegaEvolution(alakazamBefore,{side:'A',actorId:'A-0'},v3Catalog),mega=alakazamResult.battle.sides.A.roster[0];
 assert.equal(mega.speciesId,'alakazam-mega');assert.equal(mega.activeAbilityId,expectedAbility);assert.ok(alakazamResult.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='trace'&&event.effectId==='entry-ability-copy'&&event.copiedAbilityId===expectedAbility));
});

test('Mega Gyarados uses its 305 kg form weight for Heavy Slam tiers and changes to Water/Dark',()=>{
 const before=battleFor('gyarados','gyaradosite'),base=before.sides.A.roster[0],target=before.sides.B.roster[0];target.weightKg=60;
 assert.equal(base.weightKg,235);assert.equal(variableMovePower('user-target-weight-ratio',{battle:before,actor:base,target,basePower:40}),80);
 const after=applyMegaEvolution(before,{side:'A',actorId:base.actorId},v3Catalog).battle,mega=after.sides.A.roster[0],afterTarget=after.sides.B.roster[0];afterTarget.weightKg=60;
 assert.equal(mega.weightKg,305);assert.deepEqual(mega.types,['water','dark']);assert.equal(variableMovePower('user-target-weight-ratio',{battle:after,actor:mega,target:afterTarget,basePower:40}),120);
});

test('classic Mega Garchomp remains M-A legal while Mega Garchomp Z is retained only in the source catalog for M-C',()=>{
 const source=loadMegaBetaCatalog(),z=source.relations.find(relation=>relation.megaSpeciesId==='garchomp-mega-z');
 assert.ok(v3Catalog.speciesById['garchomp-mega']);assert.equal(v3Catalog.speciesById['garchomp-mega-z'],undefined);assert.deepEqual(z.regulationSets,['m-c']);
 assert.ok(v3Catalog.megaRelations.some(relation=>relation.baseSpeciesId==='garchomp'&&relation.itemId==='garchompite'&&relation.megaSpeciesId==='garchomp-mega'));
 assert.ok(!v3Catalog.megaRelations.some(relation=>relation.megaSpeciesId==='garchomp-mega-z'));
});
