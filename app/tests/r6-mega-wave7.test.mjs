import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityPowerModifiers,variableMovePower} from '../mechanics-v3/index.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const promoted=[
 ['lopunny','lopunny-mega','lopunnite',["normal", "fighting"],'scrappy',1.3,28.3],
 ['pidgeot','pidgeot-mega','pidgeotite',["normal", "flying"],'no-guard',2.2,50.5],
 ['sableye','sableye-mega','sablenite',["dark", "ghost"],'magic-bounce',0.5,161],
 ['sharpedo','sharpedo-mega','sharpedonite',["water", "dark"],'strong-jaw',2.5,130.3],
 ['slowbro','slowbro-mega','slowbronite',["water", "psychic"],'shell-armor',2,120],
 ['tyranitar','tyranitar-mega','tyranitarite',["rock", "dark"],'sand-stream',2.5,255],
 ['chandelure','chandelure-mega','chandelurite',["ghost", "fire"],'infiltrator',2.5,69.6],
 ['dragonite','dragonite-mega','dragoninite',["dragon", "flying"],'multiscale',2.2,290],
 ['clefable','clefable-mega','clefablite',["fairy", "flying"],'magic-bounce',1.7,42.3],
 ['froslass','froslass-mega','froslassite',["ice", "ghost"],'snow-warning',2.6,29.6],
 ['hawlucha','hawlucha-mega','hawluchanite',["fighting", "flying"],'no-guard',1,25],
 ['starmie','starmie-mega','starminite',["water", "psychic"],'huge-power',2.3,80],
 ['delphox','delphox-mega','delphoxite',["fire", "psychic"],'levitate',1.5,39]
];
const basePhysical=new Map([['lopunny',[1.2,33.3]],['pidgeot',[1.5,39.5]],['sableye',[0.5,11]],['sharpedo',[1.8,88.8]],['slowbro',[1.6,78.5]],['tyranitar',[2,202]],['chandelure',[1,34.3]],['dragonite',[2.2,210]],['clefable',[1.3,40]],['froslass',[1.3,26.6]],['hawlucha',[0.8,21.5]],['starmie',[1.1,80]],['delphox',[1.5,39]]]);
function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
 const mon={monId:`mega-wave7-mon-${speciesId}`,speciesId,ownership:'permanent'};
 const build={buildId:`mega-wave7-build-${speciesId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(build);
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave7-${speciesId}-${mode}`,mode,seed:8407,playerBuildIds,progression,catalog:v3Catalog});
}
for(const mode of ['single','double'])test(`r6-mega-wave7:${mode} promotes thirteen vertically-complete Mega pairs with explicit physical foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0],baseExpected=basePhysical.get(base);
  assert.equal(unit.heightM,baseExpected[0],`${base} base height`);assert.equal(unit.weightKg,baseExpected[1],`${base} base weight`);
  const valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base} eligibility`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(mega.activeAbilityId,abilityId);assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);assert.equal(mega.megaEvolved,true);
  assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.toSpeciesId===megaId&&event.heightM===heightM&&event.weightKg===weightKg));
 }
});

test('Wave 7 Mega start/lifecycle abilities activate through shared contracts',()=>{
 for(const [base,stone,weather,ability] of [['tyranitar','tyranitarite','sandstorm','sand-stream'],['froslass','froslassite','snow','snow-warning']]){
  const result=applyMegaEvolution(battleFor(base,stone),{side:'A',actorId:'A-0'},v3Catalog);assert.equal(result.battle.field.weather?.id,weather);assert.ok(result.events.some(event=>event.kind==='weatherStarted'&&event.sourceAbilityId===ability));
 }
 for(const [base,stone,ability] of [['pidgeot','pidgeotite','no-guard'],['sableye','sablenite','magic-bounce'],['chandelure','chandelurite','infiltrator'],['dragonite','dragoninite','multiscale'],['clefable','clefablite','magic-bounce'],['hawlucha','hawluchanite','no-guard'],['delphox','delphoxite','levitate']]){
  const mega=applyMegaEvolution(battleFor(base,stone),{side:'A',actorId:'A-0'},v3Catalog).battle.sides.A.roster[0];assert.equal(mega.activeAbilityId,ability,base);assert.ok(mega.passiveEffects.some(effect=>effect.sourceId===ability),`${base}:${ability}`);
 }
});

test('Wave 7 Strong Jaw and Huge Power reuse generic power/stat contracts',()=>{
 const sharp=applyMegaEvolution(battleFor('sharpedo','sharpedonite'),{side:'A',actorId:'A-0'},v3Catalog).battle,actor=sharp.sides.A.roster[0],target=sharp.sides.B.roster[0],move=v3Catalog.movesById['crunch'];
 const mods=abilityPowerModifiers(actor,move,move.mechanics,{battle:sharp,target});assert.equal(mods.apply(move.power),Math.floor(move.power*1.5));assert.ok(mods.applied.some(x=>x.sourceId==='strong-jaw'));
 const star=applyMegaEvolution(battleFor('starmie','starminite'),{side:'A',actorId:'A-0'},v3Catalog).battle.sides.A.roster[0];assert.ok(star.passiveEffects.some(effect=>effect.sourceId==='huge-power'&&effect.kind==='stat-multiplier'));
});

test('Mega Sableye reviewed weight changes Heavy Slam from minimum to maximum tier',()=>{
 const before=battleFor('sableye','sablenite'),actor=before.sides.A.roster[0],target=before.sides.B.roster[0];target.weightKg=30;assert.equal(actor.weightKg,11);assert.equal(variableMovePower('user-target-weight-ratio',{battle:before,actor,target,basePower:40}),40);
 const after=applyMegaEvolution(before,{side:'A',actorId:actor.actorId},v3Catalog).battle,mega=after.sides.A.roster[0],afterTarget=after.sides.B.roster[0];afterTarget.weightKg=30;assert.equal(mega.weightKg,161);assert.equal(variableMovePower('user-target-weight-ratio',{battle:after,actor:mega,target:afterTarget,basePower:40}),120);
});

test('R3-84 catalog exposes all 42 promoted Mega forms/relations after Wave 7',()=>{
 assert.ok(v3Catalog.megaForms.length>=42);assert.ok(v3Catalog.megaRelations.length>=42);
 for(const [base,megaId,stone] of promoted){assert.ok(v3Catalog.speciesById[base],base);assert.ok(v3Catalog.speciesById[megaId],megaId);assert.ok(v3Catalog.megaRelations.some(relation=>relation.baseSpeciesId===base&&relation.megaSpeciesId===megaId&&relation.itemId===stone),stone);}
});
