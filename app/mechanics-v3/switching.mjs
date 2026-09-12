import {actorAvailable,clone,reserveUnits,unitById} from '../rules-v3/battle-state.mjs';
import {applySwitch} from '../rules-v3/lifecycle.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId));

export function validateSwitchingChoice(battle,action,mechanics){
 if(action.kind!=='move')return {ok:true};
 const pivot=(mechanics?.handlers||[]).some(handler=>handler.id==='apply-pivot-switch');
 if(!pivot)return action.switchToId===undefined?{ok:true}:{ok:false,code:'UNEXPECTED_SWITCH_TARGET'};
 if(typeof action.switchToId!=='string'||!action.switchToId)return {ok:false,code:'PIVOT_SWITCH_TARGET_REQUIRED'};
 if(!reserveUnits(battle,action.side).some(unit=>unit.actorId===action.switchToId))return {ok:false,code:'INVALID_PIVOT_SWITCH_TARGET'};
 return {ok:true};
}

export function applyPivotSwitch(battle,{side,actorId,toId,moveId,totalDamage}){
 const next=clone(battle),actor=unitById(next,actorId);
 if(!(totalDamage>0))return failed(next,actorId,moveId,'noDamage');
 if(!actor||actor.hp<=0||!actorAvailable(next,side,actorId))return failed(next,actorId,moveId,'actorUnavailable');
 if(typeof toId!=='string'||!toId)return failed(next,actorId,moveId,'missingSwitchTarget');
 const switched=applySwitch(next,side,actorId,toId);if(!switched.ok)return failed(next,actorId,moveId,'invalidSwitchTarget');
 return {battle:switched.battle,succeeded:true,events:switched.events.map(event=>({...event,pivot:true,source:moveId}))};
}

export function applyForcedSwitches(battle,{actorId,targetIds,moveId,requireDamage=false,totalDamage=0},runtime={}){
 let next=clone(battle);const events=[];if(requireDamage&&!(totalDamage>0))return {battle:next,succeeded:false,events:[]};
 for(const targetId of targetIds||[]){const side=sideOf(next,targetId),target=unitById(next,targetId);
  if(!side||!target||target.hp<=0||!actorAvailable(next,side,targetId)){events.push({kind:'forceSwitchFailed',actorId,targetId,moveId,reason:'targetUnavailable'});continue;}
  const reserves=reserveUnits(next,side);if(!reserves.length){events.push({kind:'forceSwitchFailed',actorId,targetId,moveId,reason:'noReserve'});continue;}
  let index=0;if(reserves.length>1){if(typeof runtime.nextRandom!=='function')throw new Error('forced switch requires seeded nextRandom');index=Math.floor(runtime.nextRandom()*reserves.length);}
  const switched=applySwitch(next,side,targetId,reserves[Math.min(index,reserves.length-1)].actorId);next=switched.battle;
  events.push(...switched.events.map(event=>({...event,forced:true,source:moveId})),{kind:'forcedSwitch',actorId,targetId,moveId,toId:reserves[Math.min(index,reserves.length-1)].actorId,side});
 }
 return {battle:next,succeeded:events.some(event=>event.kind==='forcedSwitch'),events};
}

export function applyPositionSwap(battle,{side,actorId,moveId},runtime={}){
 const next=clone(battle),actor=unitById(next,actorId),slot=next.sides?.[side]?.active?.indexOf(actorId),allySlot=slot===0?1:0,allyId=next.sides?.[side]?.active?.[allySlot],ally=unitById(next,allyId);
 if(next.format!=='double'||slot<0||!ally||ally.hp<=0)return failedSwap(next,actorId,moveId,'requiresActiveAlly');
 actor.volatiles??={};const chain=actor.volatiles.allySwitch;
 if(chain){if(typeof runtime.nextRandom!=='function')throw new Error('consecutive Ally Switch requires seeded nextRandom');const counter=chain.counter;if(runtime.nextRandom()>=1/counter){delete actor.volatiles.allySwitch;return failedSwap(next,actorId,moveId,'consecutiveFailure',counter);}chain.counter=Math.min(729,counter*3);chain.endTurnTimer=2;}
 else actor.volatiles.allySwitch={id:'ally-switch',counter:3,endTurnTimer:2};
 next.sides[side].active[slot]=allyId;next.sides[side].active[allySlot]=actorId;
 return {battle:next,succeeded:true,events:[{kind:'positionsSwapped',actorId,allyId,side,fromSlot:slot,toSlot:allySlot,moveId,nextSuccessDenominator:actor.volatiles.allySwitch.counter}]};
}

function failed(battle,actorId,moveId,reason){return {battle,succeeded:false,events:[{kind:'pivotFailed',actorId,moveId,reason}]};}
function failedSwap(battle,actorId,moveId,reason,counter=null){return {battle,succeeded:false,events:[{kind:'positionSwapFailed',actorId,moveId,reason,...(counter===null?{}:{counter})}]};}
