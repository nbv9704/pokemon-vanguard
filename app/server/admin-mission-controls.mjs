import {MISSION_DEFINITIONS,applyMissionAction,ensureMissionState} from './missions.mjs';

const CATEGORIES=['daily','weekly','starter','achievements'];
const definition=(category,id)=>MISSION_DEFINITIONS[category]?.find(entry=>entry.id===id);
function completeDefinition(state,category,target){
 const missions=state.missionsV1,bucket=missions[category];
 if(target.bonus){for(const entry of MISSION_DEFINITIONS[category].filter(item=>!item.bonus))bucket.counters[entry.counter]=Math.max(bucket.counters[entry.counter]||0,entry.target);return;}
 bucket.counters[target.counter]=Math.max(bucket.counters[target.counter]||0,target.target);
}
export function applyAdminMissionMutation(state,action,{now=Date.now()}={}){
 const category=String(action.category||'');if(!CATEGORIES.includes(category))return {ok:false,code:'MISSION_CATEGORY_INVALID'};ensureMissionState(state,now);
 if(action.type==='missions.complete'){const target=definition(category,action.missionId);if(!target)return {ok:false,code:'MISSION_NOT_FOUND'};completeDefinition(state,category,target);state.revision=(state.revision||0)+1;return {ok:true,details:{category,missionId:target.id,complete:true}};}
 if(action.type==='missions.completeCategory'){for(const target of MISSION_DEFINITIONS[category])completeDefinition(state,category,target);state.revision=(state.revision||0)+1;return {ok:true,details:{category,completed:MISSION_DEFINITIONS[category].length}};}
 if(action.type==='missions.resetCategory'){if(['daily','weekly'].includes(category)){delete state.missionsV1[category];ensureMissionState(state,now);}else state.missionsV1[category]={counters:{login:0,battles:0,wins:0,recruits:0,megaEvolutions:0,teamSaves:0,ownedPokemon:0},claimed:[]};state.revision=(state.revision||0)+1;return {ok:true,details:{category,reset:true}};}
 if(action.type==='missions.claim'){const target=definition(category,action.missionId);if(!target)return {ok:false,code:'MISSION_NOT_FOUND'};const result=applyMissionAction(state,{type:'mission.claim',category,missionId:target.id,actionId:`admin:${now}:${category}:${target.id}`},{serverNow:now});if(!result.ok)return result;Object.assign(state,result.state);return {ok:true,details:{category,missionId:target.id,claimed:true,reward:result.reward}};}
 if(action.type==='missions.claimAll'){const result=applyMissionAction(state,{type:'mission.claimAll',category,actionId:`admin:${now}:${category}`},{serverNow:now});if(!result.ok)return result;Object.assign(state,result.state);return {ok:true,details:{category,claimed:result.claimed,reward:result.reward}};}
 return {ok:false,code:'UNKNOWN_ADMIN_MISSION_ACTION'};
}
