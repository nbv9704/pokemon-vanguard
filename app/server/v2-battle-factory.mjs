import {V2_createBattleMon,V2_resolveEntry,V2_transition} from '../src/v2-engine.mjs';

export const clone=value=>JSON.parse(JSON.stringify(value));
const engineCatalog=catalog=>({moveIds:catalog.moves.map(move=>move.id),abilityIds:catalog.abilities.map(ability=>ability.id),itemIds:catalog.items.map(item=>item.id)});

export function battleMon(side,index,build,species,catalog){return V2_createBattleMon({battleMonId:`${side}-${index}`,ownerSide:side,build,species,moves:catalog.movesById,catalog:engineCatalog(catalog)});}

export function pickTemplate(catalog,action,serial){
 if(Number.isInteger(action.gym))return catalog.aiTeams.gyms[action.mode][action.gym];
 const pool=catalog.aiTeams.exhibition.filter(team=>!action.difficulty||team.difficulty===action.difficulty);
 return pool[serial%pool.length];
}

export function namesFor(battle,catalog){
 const names={};
 for(const side of ['A','B'])for(const mon of battle.sides[side].roster)names[mon.battleMonId]=catalog.speciesById[mon.speciesId].name;
 for(const move of catalog.moves)names[move.id]=move.name;
 return names;
}

export function projectBattleForAi(battle,catalog,side='B'){
 const view=clone(battle);view.pending={};
 const opponent=side==='A'?'B':'A';
 for(const mon of view.sides[opponent].roster){
  const species=catalog.speciesById[mon.speciesId],publicMon=battleMon(opponent,0,species.defaultBuild,species,catalog),ratio=mon.hp/mon.stats.hp;
  mon.stats=publicMon.stats;mon.hp=Math.round(publicMon.stats.hp*ratio);mon.pp={};mon.buildSnapshot={moveIds:[],abilityId:null,itemId:'none'};mon.itemState={used:false};
 }
 return view;
}

export function projectedSnapshot(battle,catalog){
 const own=battle.sides.A.roster.map(mon=>({battleMonId:mon.battleMonId,ownerSide:mon.ownerSide,speciesId:mon.speciesId,name:catalog.speciesById[mon.speciesId].name,artId:catalog.speciesById[mon.speciesId].artId,types:[...(mon.types||[])],buildSnapshot:clone(mon.buildSnapshot),stats:clone(mon.stats),hp:mon.hp,pp:clone(mon.pp),status:clone(mon.status),stages:clone(mon.stages),volatiles:clone(mon.volatiles),itemState:clone(mon.itemState),formId:mon.formId??null,activeSlot:battle.sides.A.active.indexOf(mon.battleMonId)}));
 const opponent=battle.sides.B.roster.map(mon=>({battleMonId:mon.battleMonId,speciesId:mon.speciesId,name:catalog.speciesById[mon.speciesId].name,artId:catalog.speciesById[mon.speciesId].artId,types:mon.types,hpPercent:Math.round(mon.hp/mon.stats.hp*100),status:mon.status?.id||mon.status||null,activeSlot:battle.sides.B.active.indexOf(mon.battleMonId)}));
 return {id:battle.id,phase:battle.phase,phaseRevision:battle.phaseRevision,turn:battle.turn,activeCount:battle.activeCount,field:clone(battle.field),result:clone(battle.result),own,opponent};
}

export function enterBattle(battle,events){
 const entries=['A','B'].flatMap(side=>battle.sides[side].active.filter(Boolean).map(monId=>({side,monId})));
 const entered=V2_resolveEntry(battle,entries),transition=V2_transition(entered.battle,'COMMAND');
 return {battle:transition.battle,events:[...events,...entered.events]};
}

export function aiReplacements(battle,side='B'){
 const empty=battle.sides[side].active.map((id,slot)=>({id,slot})).filter(entry=>!entry.id||battle.sides[side].roster.find(mon=>mon.battleMonId===entry.id)?.hp<=0),active=new Set(battle.sides[side].active),reserves=battle.sides[side].roster.filter(mon=>mon.hp>0&&!active.has(mon.battleMonId));
 return empty.slice(0,reserves.length).map((entry,index)=>({slot:entry.slot,monId:reserves[index].battleMonId}));
}
