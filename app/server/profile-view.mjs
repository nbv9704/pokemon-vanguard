import {missionView} from './missions.mjs';
import {rankedProfileView} from './ranked-v1.mjs';

const clone=value=>structuredClone(value);
const activeTeamFor=progression=>progression?.teams?.find(team=>team.teamId===progression.activeTeamId)||progression?.teams?.[0]||null;

export function profileView(state,catalog,{serverNow=Date.now()}={}){
 const missions=missionView(state,serverNow),progression=state.progressionV3||null,counters=state.missionsV1?.achievements?.counters||{},activeTeam=activeTeamFor(progression);
 const permanentMons=progression?.mons?.filter(mon=>mon.ownership==='permanent')||[],ownedItemIds=new Set(progression?.ownedItemIds||[]),battleItems=(catalog.items||[]).filter(item=>item.enabledForBattle&&item.id!=='none');
 const members=(activeTeam?.buildIds||[]).map(buildId=>{
  const build=progression?.builds?.find(entry=>entry.buildId===buildId),mon=progression?.mons?.find(entry=>entry.monId===build?.monId),species=mon&&catalog.speciesById?.[mon.speciesId];
  return species?{speciesId:species.id,name:species.name,spriteKey:species.spriteKey||species.id,types:[...(species.types||[])]}:null;
 }).filter(Boolean);
 const achievements=missions.achievements.map(entry=>({id:entry.id,title:entry.title,description:entry.description,progress:entry.progress,target:entry.target,complete:entry.complete,claimed:entry.claimed,claimable:entry.claimable}));
 return {
  schemaVersion:1,
  regulation:'M-A',
  stats:{
   battles:Math.max(0,Math.trunc(counters.battles||0)),
   wins:Math.max(Math.max(0,Math.trunc(counters.wins||0)),Math.max(0,Math.trunc(state.wins||0))),
   recruits:Math.max(0,Math.trunc(counters.recruits||0)),
   megaEvolutions:Math.max(0,Math.trunc(counters.megaEvolutions||0)),
   ownedPokemon:permanentMons.length,
   totalPokemon:(catalog.species||[]).length,
   ownedItems:[...ownedItemIds].filter(id=>battleItems.some(item=>item.id===id)).length,
   totalItems:battleItems.length,
   badges:(state.badges||state.gymProgress?.badges||[]).length
  },
  activeTeam:activeTeam?{teamId:activeTeam.teamId,name:activeTeam.name,members}:null,
  ranked:rankedProfileView(state),
  achievements:{total:achievements.length,complete:achievements.filter(entry=>entry.complete).length,claimed:achievements.filter(entry=>entry.claimed).length,claimable:achievements.filter(entry=>entry.claimable).length,entries:clone(achievements)}
 };
}
