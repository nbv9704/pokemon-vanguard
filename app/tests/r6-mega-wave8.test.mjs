import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityPowerModifiers,applyDamageHit,modifyMoveByAbility,passiveDamageModifiers,receivedDamageModifiers,resolveDamageResponseAbilities,resolveProtectionBlock,validateVolatileSwitchChoice} from '../mechanics-v3/index.mjs';
import {directDamageHandler} from '../mechanics-v3/handlers/direct-damage.mjs';
import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {createV3Battle} from '../server/v3-battle-factory.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {loadMegaBetaCatalog} from '../server/v3-mega-catalog.mjs';
import {applyMegaEvolution,validateMegaChoice} from '../server/v3-mega.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';

const sourcePromoted=[
 ['aggron','aggron-mega','aggronite',['steel'],'filter',2.2,395],
 ['chimecho','chimecho-mega','chimechite',['psychic','steel'],'levitate',1.2,8],
 ['crabominable','crabominable-mega','crabominite',['fighting','ice'],'iron-fist',2.6,252.8],
 ['drampa','drampa-mega','drampanite',['normal','dragon'],'berserk',3,240.5],
 ['emboar','emboar-mega','emboarite',['fire','fighting'],'mold-breaker',1.8,180.3],
 ['excadrill','excadrill-mega','excadrite',['ground','steel'],'piercing-drill',0.9,60],
 ['floette','floette-mega','floettite',['fairy'],'fairy-aura',0.2,100.8],
 ['gengar','gengar-mega','gengarite',['ghost','poison'],'shadow-tag',1.4,40.5],
 ['glimmora','glimmora-mega','glimmoranite',['rock','poison'],'adaptability',2.8,77],
 ['golurk','golurk-mega','golurkite',['ground','ghost'],'unseen-fist',4,330],
 ['greninja','greninja-mega','greninjite',['water','dark'],'protean',1.5,40],
 ['kangaskhan','kangaskhan-mega','kangaskhanite',['normal'],'parental-bond',2.2,100],
 ['meowstic','meowstic-mega','meowsticite',['psychic'],'trace',0.8,10.1],
 ['pinsir','pinsir-mega','pinsirite',['bug','flying'],'aerilate',1.7,59],
 ['raichu','raichu-mega-x','raichunite-x',['electric'],'electric-surge',1.2,38],
 ['raichu','raichu-mega-y','raichunite',['electric'],'no-guard',1,26],
 ['scovillain','scovillain-mega','scovillainite',['grass','fire'],'spicy-spray',1.2,22],
 ['skarmory','skarmory-mega','skarmorite',['steel','flying'],'stalwart',1.7,40.4],
 ['victreebel','victreebel-mega','victreebelite',['grass','poison'],'innards-out',4.5,125.5],
 ['absol','absol-mega-z','absolite-z',['dark','ghost'],'sharpness',1.2,49],
 ['garchomp','garchomp-mega-z','garchompite-z',['dragon'],'levitate',1.9,99],
 ['lucario','lucario-mega-z','lucarionite-z',['fighting','steel'],'aura-guard',1.3,49.4]
];
const outOfScope=new Set(['raichu-mega-x','raichu-mega-y','absol-mega-z','garchomp-mega-z','lucario-mega-z']);
const promoted=sourcePromoted.filter(([,megaId])=>!outOfScope.has(megaId));

function battleFor(speciesId,itemId,mode='single'){
 const progression=createV3BetaProgression(v3Catalog),species=v3Catalog.speciesById[speciesId],defaults=species.defaultBuild;
 const mon={monId:`mega-wave8-mon-${speciesId}-${itemId}`,speciesId,ownership:'permanent'};
 const build={buildId:`mega-wave8-build-${speciesId}-${itemId}`,monId:mon.monId,name:defaults.name,natureId:defaults.natureId,statPoints:structuredClone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1};
 progression.mons.push(mon);progression.builds.push(build);
 const count=v3Catalog.regulations[0].pick[mode],others=progression.builds.filter(entry=>entry.buildId!==build.buildId).slice(0,count-1),playerBuildIds=[build.buildId,...others.map(entry=>entry.buildId)];
 return createV3Battle({id:`mega-wave8-${speciesId}-${itemId}-${mode}`,mode,seed:8508,playerBuildIds,progression,catalog:v3Catalog});
}
function megaBattle(base,stone,mode='single'){
 const battle=battleFor(base,stone,mode);if(base==='meowstic')battle.sides.A.roster[0].gender='male';
 return applyMegaEvolution(battle,{side:'A',actorId:'A-0'},v3Catalog).battle;
}
const runtime={nextRandom:()=>0.5};

for(const mode of ['single','double'])test(`r6-mega-wave8:${mode} promotes 17 M-A-legal reviewed Mega relations with explicit form foundation`,()=>{
 for(const [base,megaId,stone,types,abilityId,heightM,weightKg] of promoted){
  const battle=battleFor(base,stone,mode),unit=battle.sides.A.roster[0];if(base==='meowstic')unit.gender='male';
  const valid=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(valid.ok,true,`${base}:${stone}`);
  const result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId},v3Catalog),mega=result.battle.sides.A.roster[0],form=v3Catalog.speciesById[megaId],expected=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId);
  assert.equal(mega.speciesId,megaId);assert.deepEqual(mega.types,types);assert.equal(form.abilityId,abilityId);if(base!=='meowstic'){assert.equal(mega.activeAbilityId,abilityId);assert.ok(mega.passiveEffects.some(effect=>effect.sourceId===abilityId),`${megaId}:${abilityId}`);}else assert.ok(result.events.some(event=>event.kind==='megaEvolved'&&event.abilityId==='trace'));assert.equal(mega.heightM,heightM);assert.equal(mega.weightKg,weightKg);assert.deepEqual(mega.stats,expected);
 }
});

test('Mega Meowstic is male-only at eligibility time',()=>{
 const battle=battleFor('meowstic','meowsticite'),unit=battle.sides.A.roster[0];unit.gender='female';let result=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(result.ok,false);assert.equal(result.code,'MEGA_GENDER_REQUIRED');assert.equal(result.requiredGender,'male');
 unit.gender='male';result=validateMegaChoice(battle,{mega:true,side:'A',actorId:unit.actorId},v3Catalog);assert.equal(result.ok,true);
});

test('Wave 8 M-A field and damage modifiers execute through shared passive contracts',()=>{
 const aggron=megaBattle('aggron','aggronite'),filter=aggron.sides.A.roster[0];assert.deepEqual(receivedDamageModifiers(filter,{type:'fire'},aggron,{effectiveness:2,mechanics:{contact:false}}).values,[0.75]);assert.deepEqual(receivedDamageModifiers(filter,{type:'fire'},aggron,{effectiveness:1,mechanics:{contact:false}}).values,[]);
 const floette=megaBattle('floette','floettite'),fairy=floette.sides.A.roster[0];const mods=passiveDamageModifiers(fairy,{type:'fairy',category:'special'},floette);assert.ok(mods.values.includes(1.33));assert.ok(mods.applied.some(effect=>effect.sourceId==='fairy-aura'&&effect.holderId===fairy.actorId));
});

test('Piercing Drill and Unseen Fist pierce Protect only for contact moves at 25%',()=>{
 for(const [base,stone,moveId,ability] of [['excadrill','excadrite','iron-head','piercing-drill'],['golurk','golurkite','shadow-punch','unseen-fist']]){
  const battle=megaBattle(base,stone),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0],move=v3Catalog.movesById[moveId];target.volatiles.protect={id:'protect',sourceId:'protect',blocksStatus:true,endTurnTimer:1};
  const result=resolveProtectionBlock(battle,{targetRef:{side:'B',actorId:target.actorId},actorId:actor.actorId,move,mechanics:move.mechanics},runtime);assert.equal(result.blocked,false);assert.ok(result.events.some(event=>event.kind==='protectionPierced'&&event.abilityId===ability&&event.multiplier===0.25));
  const hit=applyDamageHit(result.battle,{actorId:actor.actorId,targetId:target.actorId,move,mechanics:move.mechanics},runtime);assert.equal(hit.events.find(event=>event.kind==='damage')?.breakdown?.protectionPierce?.multiplier,0.25);
 }
});

test('Shadow Tag blocks manual switching but preserves Ghost exemption',()=>{
 const battle=megaBattle('gengar','gengarite'),foe=battle.sides.B.roster[0];foe.types=['normal'];let result=validateVolatileSwitchChoice(battle,{kind:'switch',actorId:foe.actorId});assert.equal(result.ok,false);assert.equal(result.code,'ABILITY_SWITCH_BLOCKED');assert.equal(result.abilityId,'shadow-tag');
 foe.types=['ghost'];result=validateVolatileSwitchChoice(battle,{kind:'switch',actorId:foe.actorId});assert.equal(result.ok,true);
});

test('Parental Bond creates a second 25% hit through the normal damage pipeline',()=>{
 const battle=megaBattle('kangaskhan','kangaskhanite'),actor=battle.sides.A.roster[0],target=battle.sides.B.roster[0],move=v3Catalog.movesById['body-slam'];target.hp=target.maxHp=9999;
 const out=directDamageHandler.run({battle,payload:{action:{side:'A',actorId:actor.actorId,moveId:move.id,target:{side:'B',slot:0}},move,mechanics:move.mechanics,accuracyResolved:true,hitTargetIds:[target.actorId],resolvedTargetIds:[target.actorId]},runtime});
 const hits=out.events.filter(event=>event.kind==='damage'&&event.moveId===move.id);assert.equal(hits.length,2);assert.equal(hits[0].hit,1);assert.equal(hits[1].hit,2);assert.equal(hits[1].breakdown.explicitDamageMultiplier,0.25);assert.deepEqual(out.payload.parentalBondSecondHitTargetIds,[target.actorId]);
});

test('Aerilate, Spicy Spray and Innards Out execute their reviewed Wave 8 semantics',()=>{
 const pinsir=megaBattle('pinsir','pinsirite'),pin=pinsir.sides.A.roster[0],normal=v3Catalog.movesById['body-slam'],converted=modifyMoveByAbility(pin,normal,normal.mechanics);assert.equal(converted.move.type,'flying');assert.equal(converted.mechanics.abilityTypeConversion.multiplier,1.2);assert.equal(abilityPowerModifiers(pin,converted.move,converted.mechanics,{battle:pinsir,target:pinsir.sides.B.roster[0]}).apply(normal.power),Math.floor(normal.power*1.2));
 const spicy=megaBattle('scovillain','scovillainite'),spicyActor=spicy.sides.B.roster[0],spicyTarget=spicy.sides.A.roster[0];spicyActor.types=['normal'];spicyActor.status=null;const spicyResult=resolveDamageResponseAbilities(spicy,{actorId:spicyActor.actorId,targetId:spicyTarget.actorId,move:v3Catalog.movesById['body-slam'],damage:10,hpBefore:spicyTarget.hp,hpAfter:spicyTarget.hp-10},runtime);assert.equal(spicyResult.battle.sides.B.roster[0].status?.id||spicyResult.battle.sides.B.roster[0].status,'burn');
 const innards=megaBattle('victreebel','victreebelite'),attacker=innards.sides.B.roster[0],victim=innards.sides.A.roster[0],before=attacker.hp;victim.hp=0;const innardsResult=resolveDamageResponseAbilities(innards,{actorId:attacker.actorId,targetId:victim.actorId,move:v3Catalog.movesById['body-slam'],damage:20,hpBefore:20,hpAfter:0},runtime);assert.equal(innardsResult.battle.sides.B.roster[0].hp,before-20);assert.ok(innardsResult.events.some(event=>event.kind==='damage'&&event.abilityId==='innards-out'&&event.amount===20));
});

test('Mega Wave 8 source retains 64 implementations while the M-A runtime exposes exactly 59 legal forms/relations',()=>{
 const source=loadMegaBetaCatalog(),complete=new Set(v3Catalog.contentCompleteness.speciesIds);assert.equal(source.forms.length,64);assert.equal(source.relations.length,64);assert.equal(v3Catalog.megaForms.length,59);assert.equal(v3Catalog.megaRelations.length,59);assert.ok(complete.size>=59);assert.ok(v3Catalog.species.length>=complete.size);
 for(const [base,megaId,stone] of promoted){assert.ok(v3Catalog.speciesById[base],base);assert.ok(v3Catalog.speciesById[megaId],megaId);assert.ok(v3Catalog.megaRelations.some(relation=>relation.baseSpeciesId===base&&relation.megaSpeciesId===megaId&&relation.itemId===stone),stone);}
 const expected=new Map([['raichu-mega-x','m-b'],['raichu-mega-y','m-b'],['absol-mega-z','m-c'],['garchomp-mega-z','m-c'],['lucario-mega-z','m-c']]);for(const [megaId,regulation] of expected){assert.equal(v3Catalog.speciesById[megaId],undefined);assert.deepEqual(source.relations.find(relation=>relation.megaSpeciesId===megaId)?.regulationSets,[regulation]);}
});
