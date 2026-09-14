import {activeUnits,actorAvailable,clone,reserveUnits,unitById} from './battle-state.mjs';
import {commitEvents} from './events.mjs';
import {checkBattleResult,replacementRequirements} from './lifecycle.mjs';
import {nextRandom} from './rng.mjs';
import {orderTurnActions,prepareTurnActions} from './turn-order.mjs';

export function validateTurnActions(battle,actions,{validateAction}={}){
 const expected=['A','B'].flatMap(side=>activeUnits(battle,side).map(entry=>`${side}:${entry.actorId}`)),received=new Set(),switchTargets={A:new Set(),B:new Set()};
 if(!Array.isArray(actions)||actions.length!==expected.length)return {ok:false,code:'INVALID_ACTION_COUNT'};
 for(const action of actions){
  const key=`${action?.side}:${action?.actorId}`;
  if(!expected.includes(key)||received.has(key))return {ok:false,code:'INVALID_ACTOR'};
  if(!['move','switch','recharge'].includes(action.kind)||!Number.isFinite(action.speed)||!Number.isInteger(action.priority??0)||(action.kind==='switch'||action.kind==='recharge')&&action.mega)return {ok:false,code:'INVALID_ACTION'};
  if(action.kind==='move'&&(typeof action.moveId!=='string'||!action.moveId))return {ok:false,code:'INVALID_MOVE'};
  if(action.kind==='recharge'&&action.moveId!==undefined)return {ok:false,code:'INVALID_RECHARGE'};
  if(action.kind==='move'&&action.switchToId!==undefined){if(typeof action.switchToId!=='string'||!action.switchToId||switchTargets[action.side].has(action.switchToId))return {ok:false,code:'INVALID_SWITCH'};switchTargets[action.side].add(action.switchToId);}
  if(action.kind==='switch'){
   const reserves=new Set(reserveUnits(battle,action.side).map(unit=>unit.actorId));
   if(!reserves.has(action.toId)||switchTargets[action.side].has(action.toId))return {ok:false,code:'INVALID_SWITCH'};
   switchTargets[action.side].add(action.toId);
  }
  if(validateAction){
   const battleInput=clone(battle),actionInput=clone(action),beforeBattle=JSON.stringify(battleInput),beforeAction=JSON.stringify(actionInput),result=validateAction(battleInput,actionInput);
   if(JSON.stringify(battleInput)!==beforeBattle||JSON.stringify(actionInput)!==beforeAction)throw new Error('validateAction mutated its input');
   if(!result?.ok)return {ok:false,code:result?.code||'INVALID_ACTION_CONSTRAINT',details:clone(result||{})};
  }
  received.add(key);
 }
 return {ok:true};
}

function dynamicRank(next,entries,{trickRoom,getSpeed}){
 return orderTurnActions(entries.map(action=>{
  const speedInput=clone(next),speedBefore=JSON.stringify(speedInput),speed=getSpeed(speedInput,clone(action));
  if(JSON.stringify(speedInput)!==speedBefore)throw new Error('getSpeed mutated battle');
  if(!Number.isFinite(speed))throw new Error(`invalid dynamic speed for ${action.actorId}`);
  return {...action,speed};
 }),{trickRoom});
}

function entryKoRequiresReplacement(battle,actionEvents){
 for(const event of actionEvents||[]){
  if(event?.kind!=='switchIn')continue;
  const unit=unitById(battle,event.actorId);
  if(unit?.hp>0)continue;
  if(replacementRequirements(battle,event.side).count>0)return true;
 }
 return false;
}

function suspendResolution(next,state,events,rngState){
 const suspended=clone(state);suspended.rngState=rngState;
 next.phase='REPLACE';next.phaseRevision=(next.phaseRevision||0)+1;next.pendingResolution=suspended;
 events.push({kind:'turnSuspended',turn:next.turn,reason:'entryKoReplacement'});
 return next;
}

function finishResolution(next,events,rngState){
 delete next.pendingResolution;next.rngState=rngState;
 if(next.phase!=='FINISHED'){next.phase='END_TURN';next.phaseRevision=(next.phaseRevision||0)+1;}
 return next;
}

function continueActionQueue(battle,state,handlers,{getSpeed,isTrickRoom}){
 let next=clone(battle),rngState=state.rngState,executionOrder=clone(state.executionOrder||[]),events=[];
 const ranked=entries=>dynamicRank(next,entries,{trickRoom:typeof isTrickRoom==='function'?isTrickRoom(clone(next))===true:state.trickRoom===true,getSpeed});
 const execute=(action,kind=action.kind)=>{
  if(!actorAvailable(next,action.side,action.actorId)){events.push({kind:'actionCancelled',actorId:action.actorId,reason:'actorUnavailable',speed:action.speed,priority:action.priority??0});return {suspended:false};}
  const handler=handlers?.[kind];if(typeof handler!=='function')throw new Error(`missing action handler: ${kind}`);
  const handlerInput=clone(next),handlerBefore=JSON.stringify(handlerInput),beforeEventCount=events.length;
  const result=handler(handlerInput,clone({...action,kind}),{hasActed:actorId=>executionOrder.some(entry=>entry.actorId===actorId),nextRandom(){const roll=nextRandom(rngState);rngState=roll.rngState;return roll.value;}});
  if(JSON.stringify(handlerInput)!==handlerBefore)throw new Error(`action handler mutated battle: ${kind}`);
  if(!result?.battle||!Array.isArray(result.events))throw new Error(`invalid action result: ${kind}`);
  next=clone(result.battle);events.push(...result.events);executionOrder.push({...action,kind});
  const switchEvents=result.events.filter(event=>event?.kind==='switchIn');
  if(switchEvents.length&&typeof handlers?.entry==='function'){
   const entryInput=clone(next),entryBefore=JSON.stringify(entryInput),entryResult=handlers.entry(entryInput,clone(switchEvents));
   if(JSON.stringify(entryInput)!==entryBefore)throw new Error('entry handler mutated battle');
   if(!entryResult?.battle||!Array.isArray(entryResult.events))throw new Error('invalid entry handler result');
   next=clone(entryResult.battle);events.push(...entryResult.events);
  }
  const outcome=checkBattleResult(next);next=outcome.battle;events.push(...outcome.events);
  const actionEvents=events.slice(beforeEventCount);
  return {suspended:next.phase!=='FINISHED'&&entryKoRequiresReplacement(next,actionEvents)};
 };
 const stages=[
  ['switchPending','switch',action=>action],
  ['megaPending','mega',action=>({...action,priority:0})],
  ['movePending',action=>action.kind,action=>action],
 ];
 for(const [key,kindSpec,rankShape] of stages){
  while(state[key]?.length&&next.phase!=='FINISHED'){
   const rankedPending=ranked(state[key].map(rankShape)),action=rankedPending[0],index=state[key].findIndex(entry=>entry.actorId===action.actorId);state[key].splice(index,1);
   const kind=typeof kindSpec==='function'?kindSpec(action):kindSpec;
   const outcome=kind==='mega'&&!actorAvailable(next,action.side,action.actorId)?{suspended:false}:execute(action,kind);
   if(outcome.suspended){next=suspendResolution(next,{...state,executionOrder},events,rngState);return {battle:next,events,executionOrder,rngState,suspended:true};}
  }
 }
 next=finishResolution(next,events,rngState);
 return {battle:next,events,executionOrder,rngState,suspended:false};
}

export function resolveActionQueue(battle,actions,handlers,{trickRoom=false,isTrickRoom,getSpeed=(_battle,action)=>action.speed,validateAction}={}){
 if(battle.phase!=='RESOLVE')return {ok:false,code:'WRONG_PHASE'};
 if(battle.pendingResolution)return {ok:false,code:'RESOLUTION_ALREADY_SUSPENDED'};
 const valid=validateTurnActions(battle,actions,{validateAction});if(!valid.ok)return valid;
 const input=JSON.stringify(battle),prepared=prepareTurnActions(actions,battle.rngState),state={
  switchPending:prepared.actions.filter(action=>action.kind==='switch'),
  megaPending:prepared.actions.filter(action=>action.kind==='move'&&action.mega),
  movePending:prepared.actions.filter(action=>action.kind==='move'||action.kind==='recharge'),
  executionOrder:[],rngState:prepared.rngState,trickRoom:trickRoom===true,
 };
 const next=clone(battle),initialEvents=[{kind:'turnStarted',turn:next.turn}],continued=continueActionQueue(next,state,handlers,{getSpeed,isTrickRoom}),committed=commitEvents(continued.battle,[...initialEvents,...continued.events]);
 if(JSON.stringify(battle)!==input)throw new Error('resolveActionQueue mutated its input');
 return {ok:true,queue:continued.executionOrder,suspended:continued.suspended,...committed};
}

export function resumeActionQueue(battle,handlers,{getSpeed=(_battle,action)=>action.speed,isTrickRoom}={}){
 if(battle.phase!=='RESOLVE')return {ok:false,code:'WRONG_PHASE'};
 if(!battle.pendingResolution)return {ok:false,code:'NO_SUSPENDED_RESOLUTION'};
 const input=JSON.stringify(battle),state=clone(battle.pendingResolution),working=clone(battle);delete working.pendingResolution;
 const continued=continueActionQueue(working,state,handlers,{getSpeed,isTrickRoom}),events=[{kind:'turnResumed',turn:working.turn},...continued.events],committed=commitEvents(continued.battle,events);
 if(JSON.stringify(battle)!==input)throw new Error('resumeActionQueue mutated its input');
 return {ok:true,queue:continued.executionOrder,suspended:continued.suspended,...committed};
}
