import {ensureEconomyState} from './v2-economy-ledger.mjs';
import {ensureMissionState} from './missions.mjs';
import {ensureRankedState} from './ranked-v1.mjs';
import {ensureV3ItemInventory} from './v3-item-shop.mjs';
import {V3_BEGINNING_ITEM_IDS} from './v3-item-acquisition.mjs';
import {validateV3Team} from './v3-progression.mjs';
import {grantPokemonToProgression} from './admin-progression-grants.mjs';
import {applyAdminMissionMutation} from './admin-mission-controls.mjs';
import {ensureTicketBag} from './ticket-bag.mjs';

const clone=value=>structuredClone(value);
const nonNegativeInt=(value,max=1_000_000_000)=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=max?Number(value):null;
const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim();

function revokePokemon(progression,speciesId){
 const mons=progression.mons.filter(mon=>mon.speciesId===speciesId);if(!mons.length)return {ok:false,code:'POKEMON_NOT_OWNED'};
 const monIds=new Set(mons.map(mon=>mon.monId)),buildIds=new Set(progression.builds.filter(build=>monIds.has(build.monId)).map(build=>build.buildId));
 if(progression.teams.some(team=>team.buildIds.some(id=>buildIds.has(id))))return {ok:false,code:'POKEMON_IN_TEAM'};
 progression.mons=progression.mons.filter(mon=>!monIds.has(mon.monId));progression.builds=progression.builds.filter(build=>!monIds.has(build.monId));progression.revision++;return {ok:true};
}
function rankedReset(ranked){Object.assign(ranked,{rating:1000,peakRating:1000,matches:0,wins:0,losses:0,draws:0,lastDelta:0,lastMatchAt:null,history:[]});}
function stopLocalBattle(state){
 const stopped=[];
 if(state.battleV3&&state.battleV3.phase!=='FINISHED'){
  if(state.battleV3.phase==='PREVIEW'||!state.battleV3.battle)state.battleV3=null;
  else{const session=state.battleV3,battle=clone(session.battle);battle.phase='FINISHED';battle.phaseRevision=(battle.phaseRevision||0)+1;battle.result={winner:null,reason:'admin-stop',turn:battle.turn||0,receiptId:`${battle.id}:admin-stop`};state.battleV3={...session,phase:'FINISHED',battle,lastEvents:[{kind:'battleEnded',winner:null,reason:'admin-stop'}],reward:{coins:0,crystals:0,receiptId:null}};}
  stopped.push('pve-v3');
 }
 if(state.battleV2&&state.battleV2.phase!=='FINISHED'){
  if(state.battleV2.phase==='PREVIEW'||!state.battleV2.battle)state.battleV2=null;
  else{const session=state.battleV2,battle=clone(session.battle);battle.phase='FINISHED';battle.phaseRevision=(battle.phaseRevision||0)+1;battle.result={winner:null,reason:'admin-stop',turn:battle.turn||0,receiptId:`${battle.id}:admin-stop`};state.battleV2={...session,phase:'FINISHED',battle,result:clone(battle.result),lastEvents:[{kind:'battleEnded',winner:null,reason:'admin-stop'}],reward:{coins:0,crystals:0,receiptId:null}};}
  stopped.push('pve-v2');
 }
 return stopped;
}

export function applyAdminMutation(state,action,catalog,{now=Date.now()}={}){
 const next=clone(state);if(!next?.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};
 ensureEconomyState(next);ensureRankedState(next);ensureV3ItemInventory(next.progressionV3,catalog);const type=action?.type;
 if(type==='economy.set'){
  const coins=nonNegativeInt(action.coins),crystals=nonNegativeInt(action.crystals),tickets=action.recruitmentTickets===undefined?(next.wallet?.recruitmentTickets??0):nonNegativeInt(action.recruitmentTickets,1_000_000);if([coins,crystals,tickets].includes(null))return {ok:false,code:'INVALID_BALANCE'};
  Object.assign(next.wallet,{coins,crystals,recruitmentTickets:tickets});next.coins=coins;next.gems=crystals;next.recruitmentTickets=tickets;next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{coins,crystals,recruitmentTickets:tickets}};
 }
 if(type==='tickets.set'){
  const recruitmentTickets=nonNegativeInt(action.recruitmentTickets,1_000_000),shopTickets=nonNegativeInt(action.shopTickets,1_000_000),trainingTickets=nonNegativeInt(action.trainingTickets,1_000_000),rankTickets=nonNegativeInt(action.rankTickets,1_000_000);
  if([recruitmentTickets,shopTickets,trainingTickets,rankTickets].includes(null))return {ok:false,code:'INVALID_TICKET_BALANCE'};
  if(action.rankProtectionArmed!==undefined&&typeof action.rankProtectionArmed!=='boolean')return {ok:false,code:'INVALID_PROTECTION_STATE'};
  Object.assign(next.wallet,{recruitmentTickets});next.recruitmentTickets=recruitmentTickets;
  const bag=ensureTicketBag(next);bag.shopTickets=shopTickets;bag.trainingTickets=trainingTickets;bag.rankTickets=rankTickets;
  bag.rankProtectionArmed=rankTickets>0&&(typeof action.rankProtectionArmed==='boolean'?action.rankProtectionArmed:bag.rankProtectionArmed);
  next.revision=(next.revision||0)+1;
  return {ok:true,state:next,details:{recruitmentTickets,shopTickets,trainingTickets,rankTickets,rankProtectionArmed:bag.rankProtectionArmed}};
 }
 if(type==='item.grant'||type==='item.revoke'){
  const item=catalog.itemsById[action.itemId];if(!item?.enabledForBattle)return {ok:false,code:'ITEM_NOT_FOUND'};const owned=new Set(next.progressionV3.ownedItemIds||[]);
  if(type==='item.grant'){if(owned.has(item.id))return {ok:false,code:'ITEM_ALREADY_OWNED'};owned.add(item.id);}else{if(!owned.has(item.id))return {ok:false,code:'ITEM_NOT_OWNED'};if(V3_BEGINNING_ITEM_IDS.includes(item.id))return {ok:false,code:'BEGINNING_ITEM_LOCKED'};if(next.progressionV3.builds.some(build=>build.itemId===item.id))return {ok:false,code:'ITEM_IN_USE'};owned.delete(item.id);}
  next.progressionV3.ownedItemIds=[...owned];next.progressionV3.revision++;next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{itemId:item.id,itemName:item.name,owned:type==='item.grant'}};
 }
 if(type==='pokemon.grant'||type==='pokemon.revoke'){
  const species=catalog.speciesById[action.speciesId];if(!species?.enabledForBattle)return {ok:false,code:'POKEMON_NOT_FOUND'};
  const result=type==='pokemon.grant'?grantPokemonToProgression(next.progressionV3,species):revokePokemon(next.progressionV3,species.id);if(!result.ok)return result;ensureMissionState(next,now);next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{speciesId:species.id,speciesName:species.name,owned:type==='pokemon.grant'}};
 }
 if(type==='team.activate'){
  const team=next.progressionV3.teams.find(entry=>entry.teamId===action.teamId);if(!team)return {ok:false,code:'TEAM_NOT_FOUND'};const problems=validateV3Team(team,next.progressionV3,catalog);if(problems.length)return {ok:false,code:'TEAM_ILLEGAL',details:problems};next.progressionV3.activeTeamId=team.teamId;next.progressionV3.revision++;next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{teamId:team.teamId,teamName:team.name}};
 }
 if(type==='ranked.setRating'){
  const rating=nonNegativeInt(action.rating,99_999);if(rating===null)return {ok:false,code:'INVALID_RATING'};next.rankedV1.rating=rating;next.rankedV1.peakRating=Math.max(next.rankedV1.peakRating||0,rating);next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{rating}};
 }
 if(type==='ranked.reset'){rankedReset(next.rankedV1);next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{rating:1000}};}
 if(type==='missions.reset'){delete next.missionsV1;ensureMissionState(next,now);next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{reset:true}};}
 if(type?.startsWith('missions.')){const result=applyAdminMissionMutation(next,action,{now});if(!result.ok)return result;return {ok:true,state:next,details:result.details};}
 if(type==='battle.stopLocal'){
  const stopped=stopLocalBattle(next);if(!stopped.length)return {ok:false,code:'NO_ACTIVE_LOCAL_BATTLE'};next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{stopped}};
 }
 if(type==='account.note'){
  const note=clean(action.note).slice(0,1000);next.adminV1={...(next.adminV1||{}),note,updatedAt:new Date(now).toISOString()};next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{noteLength:note.length}};
 }
 if(type==='account.suspend'){
  const suspended=!!action.suspended,reason=clean(action.reason).slice(0,240);next.adminV1={...(next.adminV1||{}),suspended,reason:suspended?reason:'',updatedAt:new Date(now).toISOString()};next.revision=(next.revision||0)+1;return {ok:true,state:next,details:{suspended,reason:suspended?reason:''}};
 }
 return {ok:false,code:'UNKNOWN_ADMIN_ACTION'};
}

export function appendAdminAudit(state,{adminId,action,details,now=Date.now()}){
 const audit=state.adminAuditV1&&typeof state.adminAuditV1==='object'?state.adminAuditV1:{version:1,entries:[]};if(!Array.isArray(audit.entries))audit.entries=[];audit.version=1;audit.entries.unshift({at:new Date(now).toISOString(),adminId:String(adminId||'admin').slice(0,128),action:String(action||'unknown').slice(0,80),details:clone(details||{})});audit.entries=audit.entries.slice(0,100);state.adminAuditV1=audit;return state;
}
