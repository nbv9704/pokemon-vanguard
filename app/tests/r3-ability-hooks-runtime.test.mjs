import test from 'node:test';
import assert from 'node:assert/strict';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BattleUnit,mechanicCatalog} from '../server/v3-battle-factory.mjs';

const manifests=mechanicCatalog(v3Catalog),resolveMove=createMoveActionHandler({moves:v3Catalog.movesById,manifests:manifests.moves,registry:createHookRegistry(HANDLER_DEFINITIONS)}),runtime={nextRandom:()=>.999};
const build=(speciesId,{abilityId,moveIds,itemId=null}={})=>{const species=v3Catalog.speciesById[speciesId],base=species.defaultBuild;return {buildId:`test-${speciesId}`,monId:`mon-${speciesId}`,name:`${species.name} Test`,natureId:base.natureId,statPoints:structuredClone(base.statPoints),moveIds:moveIds||[...base.moveIds],abilityId:abilityId||base.abilityId,itemId:itemId||base.itemId};};
const mon=speciesId=>({monId:`mon-${speciesId}`,speciesId});
const makeUnit=(side,index,speciesId,options)=>createV3BattleUnit(side,index,build(speciesId,options),mon(speciesId),v3Catalog);
function fixture(format='single'){
 const primarina=makeUnit('A',0,'primarina',{abilityId:'liquid-voice',moveIds:['hyper-voice','sing','perish-song','protect']}),ally=makeUnit('A',1,'blastoise'),charizard=makeUnit('B',0,'charizard'),typhlosion=makeUnit('B',1,'typhlosion'),count=format==='double'?2:1;
 return {id:`ability-runtime-${format}`,rulesVersion:v3Catalog.metadata.rulesVersion,catalogVersion:v3Catalog.metadata.catalogVersion,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:count,rngState:7,field:{},sides:{A:{active:[primarina,ally].slice(0,count).map(x=>x.actorId),roster:[primarina,ally],conditions:{}},B:{active:[charizard,typhlosion].slice(0,count).map(x=>x.actorId),roster:[charizard,typhlosion],conditions:{}}}};
}
const action=()=>({kind:'move',side:'A',actorId:'A-0',moveId:'hyper-voice',speed:100,priority:0});

for(const format of ['single','double'])test(`schema-3 ${format} factory compiles Liquid Voice and Hyper Voice through the shared Ability hook runtime`,()=>{
 const battle=fixture(format),actor=battle.sides.A.roster[0];assert.equal(actor.activeAbilityId,'liquid-voice');assert.ok(actor.passiveEffects.some(effect=>effect.kind==='move-type-by-tag'&&effect.sourceId==='liquid-voice'));
 const result=resolveMove(battle,action(),runtime),damages=result.events.filter(event=>event.kind==='damage'&&event.actorId==='A-0');assert.equal(damages.length,format==='double'?2:1);assert.ok(damages.every(event=>event.effectiveness===2));assert.ok(damages.every(event=>event.breakdown.stab===1.5));assert.ok(result.events.some(event=>event.kind==='abilityTriggered'&&event.abilityId==='liquid-voice'&&event.toType==='water'));
});
