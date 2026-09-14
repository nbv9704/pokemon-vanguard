import {calculateLevel50Stats,completeEntry,createBattleSnapshot} from '../rules-v3/index.mjs';
import {compilePassiveEffects,createHeldItemState} from '../mechanics-v3/index.mjs';

const clone=value=>structuredClone(value);
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
export const mechanicCatalog=catalog=>({moves:Object.fromEntries(catalog.moves.map(entry=>[entry.id,entry.mechanics])),abilities:Object.fromEntries(catalog.abilities.map(entry=>[entry.id,entry.mechanics])),items:Object.fromEntries(catalog.items.map(entry=>[entry.id,entry.mechanics]))});

export function createV3BattleUnit(side,index,build,mon,catalog){
 const species=catalog.speciesById[mon.speciesId],stats=calculateLevel50Stats(species.baseStats,build.statPoints,build.natureId),manifests=mechanicCatalog(catalog);
 return {actorId:`${side}-${index}`,baseSpeciesId:species.id,speciesId:species.id,name:species.name,spriteKey:species.spriteKey,types:[...species.types],level:50,hp:stats.hp,maxHp:stats.hp,stats,stages:stages(),status:null,volatiles:{},pp:Object.fromEntries(build.moveIds.map(id=>[id,catalog.movesById[id].maxPP])),buildSnapshot:{name:build.name,natureId:build.natureId,statPoints:clone(build.statPoints),moveIds:[...build.moveIds],abilityId:build.abilityId,itemId:build.itemId},activeAbilityId:build.abilityId,itemState:createHeldItemState(build.itemId),megaEvolved:false,passiveEffects:compilePassiveEffects({abilityId:build.abilityId,itemId:build.itemId,manifests})};
}

export function publicV3Preview(team,progression,catalog){return team.buildIds.map(buildId=>{const build=progression.builds.find(entry=>entry.buildId===buildId),mon=progression.mons.find(entry=>entry.monId===build.monId),species=catalog.speciesById[mon.speciesId];return {buildId,speciesId:species.id,name:species.name,types:[...species.types],spriteKey:species.spriteKey};});}

export function createV3Battle({id,mode,seed,playerBuildIds,progression,catalog}){
 const count=catalog.regulations[0].pick[mode],playerBuilds=playerBuildIds.map(id=>progression.builds.find(entry=>entry.buildId===id)),enemyBuilds=[...progression.builds].reverse().slice(0,count),unit=(side,build,index)=>createV3BattleUnit(side,index,build,progression.mons.find(mon=>mon.monId===build.monId),catalog);
 const sides={A:{active:[],roster:playerBuilds.map((build,index)=>unit('A',build,index)),conditions:{}},B:{active:[],roster:enemyBuilds.map((build,index)=>unit('B',build,index)),conditions:{}}},activeCount=mode==='double'?2:1;
 sides.A.active=sides.A.roster.slice(0,activeCount).map(entry=>entry.actorId);sides.B.active=sides.B.roster.slice(0,activeCount).map(entry=>entry.actorId);
 const battle=createBattleSnapshot({id,rulesVersion:catalog.metadata.rulesVersion,catalogVersion:catalog.metadata.catalogVersion,format:mode,seed,sides});battle.level=50;battle.regulationId=catalog.regulations[0].id;battle.megaLimit=catalog.regulations[0].megaCount||0;battle.megaUsed={A:0,B:0};
 return completeEntry(battle,[...sides.A.active.map(actorId=>({kind:'switchIn',actorId,side:'A',entry:true})),...sides.B.active.map(actorId=>({kind:'switchIn',actorId,side:'B',entry:true}))]).battle;
}
