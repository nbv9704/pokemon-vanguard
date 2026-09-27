import {applyEconomyTransaction,validateEconomyActionId} from './v2-economy-ledger.mjs';

const clone=value=>structuredClone(value);
const DAY=24*60*60*1000,WEEK=7*DAY;

export const MISSION_DEFINITIONS=Object.freeze({
 daily:Object.freeze([
  {id:'daily-login',title:'Log in to the game',description:'Open your adventure today.',counter:'login',target:1,reward:{recruitmentTickets:6},route:'home'},
  {id:'daily-battle',title:'Take part in a battle',description:'Complete one Single or Double Battle.',counter:'battles',target:1,reward:{recruitmentTickets:12},route:'battle'},
  {id:'daily-recruit',title:'Recruit a Pokémon',description:'Start a trial or recruit a partner permanently.',counter:'recruits',target:1,reward:{recruitmentTickets:6},route:'recruitment'},
  {id:'daily-win',title:'Win a battle',description:'Defeat an AI challenger in any format.',counter:'wins',target:1,reward:{coins:600},route:'battle'},
  {id:'daily-complete',title:'Complete all daily missions',description:'Finish the four daily missions above.',counter:'dailyComplete',target:4,reward:{crystals:300},route:'missions',bonus:true}
 ]),
 weekly:Object.freeze([
  {id:'weekly-battles',title:'Complete 5 battles',description:'Finish five battles during this weekly cycle.',counter:'battles',target:5,reward:{recruitmentTickets:20},route:'battle'},
  {id:'weekly-wins',title:'Win 3 battles',description:'Win three battles during this weekly cycle.',counter:'wins',target:3,reward:{recruitmentTickets:15},route:'battle'},
  {id:'weekly-recruits',title:'Recruit 3 Pokémon',description:'Use trials or permanent recruitment three times.',counter:'recruits',target:3,reward:{coins:1800},route:'recruitment'},
  {id:'weekly-mega',title:'Use Mega Evolution',description:'Mega Evolve a partner during battle.',counter:'megaEvolutions',target:1,reward:{crystals:500},route:'battle'},
  {id:'weekly-complete',title:'Complete all weekly missions',description:'Finish the four weekly missions above.',counter:'weeklyComplete',target:4,reward:{recruitmentTickets:25},route:'missions',bonus:true}
 ]),
 starter:Object.freeze([
  {id:'starter-battle',title:'First steps into battle',description:'Complete your first battle.',counter:'battles',target:1,reward:{coins:1000},route:'battle'},
  {id:'starter-win',title:'Your first victory',description:'Win your first battle.',counter:'wins',target:1,reward:{crystals:500},route:'battle'},
  {id:'starter-recruit',title:'Meet a new partner',description:'Recruit a Pokémon by trial or permanently.',counter:'recruits',target:1,reward:{recruitmentTickets:10},route:'recruitment'},
  {id:'starter-team',title:'Shape your squad',description:'Save a team in Team Builder.',counter:'teamSaves',target:1,reward:{coins:1200},route:'teams'},
  {id:'starter-roster',title:'Build a roster of 10',description:'Own ten permanent Pokémon.',counter:'ownedPokemon',target:10,reward:{recruitmentTickets:20},route:'collection'}
 ]),
 achievements:Object.freeze([
  {id:'achievement-battles-10',title:'Battle Tested',description:'Complete 10 battles across Single and Double formats.',counter:'battles',target:10,reward:{recruitmentTickets:25},route:'battle'},
  {id:'achievement-wins-10',title:'League Contender',description:'Win 10 battles.',counter:'wins',target:10,reward:{crystals:1000},route:'battle'},
  {id:'achievement-recruits-10',title:'Team Scout',description:'Recruit 10 Pokémon through trials or permanent recruitment.',counter:'recruits',target:10,reward:{coins:5000},route:'recruitment'},
  {id:'achievement-roster-25',title:'Growing Pokédex',description:'Own 25 Pokémon permanently.',counter:'ownedPokemon',target:25,reward:{recruitmentTickets:40},route:'collection'},
  {id:'achievement-mega-10',title:'Mega Specialist',description:'Use Mega Evolution 10 times in battle.',counter:'megaEvolutions',target:10,reward:{crystals:1500},route:'battle'},
  {id:'achievement-battles-50',title:'Seasoned Battler',description:'Complete 50 battles.',counter:'battles',target:50,reward:{coins:10000},route:'battle'}
 ])
});

const emptyCounters=()=>({login:0,battles:0,wins:0,recruits:0,megaEvolutions:0,teamSaves:0,ownedPokemon:0});
const dailyPeriod=now=>{const start=Math.floor(now/DAY)*DAY;return {id:new Date(start).toISOString().slice(0,10),startsAt:start,endsAt:start+DAY};};
const weeklyPeriod=now=>{const date=new Date(now),day=(date.getUTCDay()+6)%7,start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-day*DAY;return {id:new Date(start).toISOString().slice(0,10),startsAt:start,endsAt:start+WEEK};};
const freshPeriod=period=>({periodId:period.id,startsAt:period.startsAt,endsAt:period.endsAt,counters:emptyCounters(),claimed:[]});
const permanentOwned=state=>state.progressionV3?.mons?.filter(mon=>mon.ownership==='permanent').length??state.mons?.filter(mon=>mon.ownership==='permanent').length??state.collection?.length??0;

export function ensureMissionState(state,now=Date.now(),{login=false}={}){
 const daily=dailyPeriod(now),weekly=weeklyPeriod(now),existing=state.missionsV1&&typeof state.missionsV1==='object'?state.missionsV1:{};
 if(existing.daily?.periodId!==daily.id)existing.daily=freshPeriod(daily);
 if(existing.weekly?.periodId!==weekly.id)existing.weekly=freshPeriod(weekly);
 if(!existing.starter)existing.starter={counters:emptyCounters(),claimed:[]};
 if(!existing.achievements)existing.achievements={counters:emptyCounters(),claimed:[]};
 for(const category of [existing.daily,existing.weekly,existing.starter,existing.achievements]){category.counters={...emptyCounters(),...(category.counters||{})};category.claimed=Array.isArray(category.claimed)?category.claimed:[];}
 existing.version=2;
 if(login)existing.daily.counters.login=Math.max(1,existing.daily.counters.login);
 existing.starter.counters.ownedPokemon=Math.max(existing.starter.counters.ownedPokemon,permanentOwned(state));
 existing.starter.counters.wins=Math.max(existing.starter.counters.wins,Math.min(1,Math.max(0,Number(state.wins)||0)));
 existing.achievements.counters.ownedPokemon=Math.max(existing.achievements.counters.ownedPokemon,permanentOwned(state));
 existing.achievements.counters.wins=Math.max(existing.achievements.counters.wins,Math.max(0,Number(state.wins)||0));
 state.missionsV1=existing;return existing;
}

export function recordMissionEvent(state,event,amount=1,now=Date.now()){
 const missions=ensureMissionState(state,now),value=Math.max(0,Math.trunc(amount||0));if(!value)return state;
 if(Object.hasOwn(missions.daily.counters,event))missions.daily.counters[event]+=value;
 if(Object.hasOwn(missions.weekly.counters,event))missions.weekly.counters[event]+=value;
 if(Object.hasOwn(missions.starter.counters,event))missions.starter.counters[event]+=value;
 if(Object.hasOwn(missions.achievements.counters,event))missions.achievements.counters[event]+=value;
 missions.starter.counters.ownedPokemon=Math.max(missions.starter.counters.ownedPokemon,permanentOwned(state));
 missions.achievements.counters.ownedPokemon=Math.max(missions.achievements.counters.ownedPokemon,permanentOwned(state));
 return state;
}

function missionProgress(category,definition){
 if(definition.counter==='dailyComplete'||definition.counter==='weeklyComplete'){
  const definitions=MISSION_DEFINITIONS[category].filter(entry=>!entry.bonus),bucket=this[category];
  return definitions.filter(entry=>(bucket.counters[entry.counter]||0)>=entry.target).length;
 }
 return this[category].counters[definition.counter]||0;
}
function projectCategory(missions,category){const bucket=missions[category];return MISSION_DEFINITIONS[category].map(definition=>{const progress=Math.min(definition.target,missionProgress.call(missions,category,definition)),complete=progress>=definition.target,claimed=bucket.claimed.includes(definition.id);return {...definition,progress,complete,claimed,claimable:complete&&!claimed};});}
export function missionView(state,now=Date.now()){
 const holder=structuredClone(state),missions=ensureMissionState(holder,now),daily=projectCategory(missions,'daily'),weekly=projectCategory(missions,'weekly'),starter=projectCategory(missions,'starter'),achievements=projectCategory(missions,'achievements'),claimableCount=[...daily,...weekly,...starter,...achievements].filter(entry=>entry.claimable).length;
 return {version:2,serverNow:now,dailyEndsAt:missions.daily.endsAt,weeklyEndsAt:missions.weekly.endsAt,daily,weekly,starter,achievements,claimableCount};
}

export const isMissionAction=action=>['mission.claim','mission.claimAll'].includes(action?.type);
const findMission=(category,id)=>MISSION_DEFINITIONS[category]?.find(entry=>entry.id===id);
function rewardMission(state,category,definition,actionId){
 const bucket=state.missionsV1[category];if(bucket.claimed.includes(definition.id))return {ok:false,code:'MISSION_ALREADY_CLAIMED'};
 const progress=missionProgress.call(state.missionsV1,category,definition);if(progress<definition.target)return {ok:false,code:'MISSION_NOT_COMPLETE'};
 const period=['starter','achievements'].includes(category)?category:bucket.periodId,receiptId=`mission:${category}:${period}:${definition.id}`,tx=applyEconomyTransaction(state,{receiptId,actionId,kind:'mission.reward',delta:definition.reward,details:{category,missionId:definition.id}});if(!tx.ok)return tx;
 bucket.claimed.push(definition.id);return {ok:true,reward:clone(definition.reward),receiptId};
}
export function applyMissionAction(state,action,{serverNow=Date.now()}={}){
 if(!isMissionAction(action))return {ok:false,code:'UNKNOWN_MISSION_ACTION'};
 if(!validateEconomyActionId(action.actionId))return {ok:false,code:'ACTION_ID_REQUIRED'};
 const base=clone(state);ensureMissionState(base,serverNow);
 if(!['daily','weekly','starter','achievements'].includes(action.category))return {ok:false,code:'MISSION_CATEGORY_INVALID'};
 if(action.type==='mission.claim'){const definition=findMission(action.category,action.missionId);if(!definition)return {ok:false,code:'MISSION_NOT_FOUND'};const result=rewardMission(base,action.category,definition,action.actionId);if(!result.ok)return result;base.notice='Mission reward claimed.';return {ok:true,state:base,claimed:[definition.id],reward:result.reward};}
 const claimed=[],reward={coins:0,crystals:0,recruitmentTickets:0};
 for(const definition of MISSION_DEFINITIONS[action.category]){const bucket=base.missionsV1[action.category];if(bucket.claimed.includes(definition.id)||missionProgress.call(base.missionsV1,action.category,definition)<definition.target)continue;const result=rewardMission(base,action.category,definition,`${action.actionId}:${definition.id}`);if(!result.ok)return result;claimed.push(definition.id);for(const key of Object.keys(reward))reward[key]+=definition.reward[key]||0;}
 if(!claimed.length)return {ok:false,code:'NO_MISSION_REWARDS'};base.notice=`Claimed ${claimed.length} mission reward${claimed.length===1?'':'s'}.`;
 return {ok:true,state:base,claimed,reward};
}
