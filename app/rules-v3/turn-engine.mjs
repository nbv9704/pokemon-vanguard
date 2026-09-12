import {activeUnits,actorAvailable,clone,reserveUnits} from './battle-state.mjs';
import {commitEvents} from './events.mjs';
import {checkBattleResult} from './lifecycle.mjs';
import {nextRandom} from './rng.mjs';
import {orderTurnActions,prepareTurnActions} from './turn-order.mjs';

export function validateTurnActions(battle,actions,{validateAction}={}){
 const expected=['A','B'].flatMap(side=>activeUnits(battle,side).map(entry=>`${side}:${entry.actorId}`)),received=new Set(),switchTargets={A:new Set(),B:new Set()};
 if(!Array.isArray(actions)||actions.length!==expected.length)return {ok:false,code:'INVALID_ACTION_COUNT'};
 for(const action of actions){
  const key=`${action?.side}:${action?.actorId}`;
  if(!expected.includes(key)||received.has(key))return {ok:false,code:'INVALID_ACTOR'};
  if(!['move','switch'].includes(action.kind)||!Number.isFinite(action.speed)||!Number.isInteger(action.priority??0)||action.kind==='switch'&&action.mega)return {ok:false,code:'INVALID_ACTION'};
  if(action.kind==='move'&&(typeof action.moveId!=='string'||!action.moveId))return {ok:false,code:'INVALID_MOVE'};
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

export function resolveActionQueue(battle,actions,handlers,{trickRoom=false,getSpeed=(_battle,action)=>action.speed,validateAction}={}){
 if(battle.phase!=='RESOLVE')return {ok:false,code:'WRONG_PHASE'};
 const valid=validateTurnActions(battle,actions,{validateAction});if(!valid.ok)return valid;
 const input=JSON.stringify(battle),prepared=prepareTurnActions(actions,battle.rngState);
 let next=clone(battle),rngState=prepared.rngState;const events=[{kind:'turnStarted',turn:next.turn}],executionOrder=[];
 const ranked=entries=>orderTurnActions(entries.map(action=>{
  const speedInput=clone(next),speedBefore=JSON.stringify(speedInput),speed=getSpeed(speedInput,clone(action));
  if(JSON.stringify(speedInput)!==speedBefore)throw new Error('getSpeed mutated battle');
  if(!Number.isFinite(speed))throw new Error(`invalid dynamic speed for ${action.actorId}`);
  return {...action,speed};
 }),{trickRoom});
 const execute=(action,kind=action.kind)=>{
  if(!actorAvailable(next,action.side,action.actorId)){events.push({kind:'actionCancelled',actorId:action.actorId,reason:'actorUnavailable',speed:action.speed,priority:action.priority??0});return;}
  const handler=handlers?.[kind];if(typeof handler!=='function')throw new Error(`missing action handler: ${kind}`);
  const handlerInput=clone(next),handlerBefore=JSON.stringify(handlerInput);
  const result=handler(handlerInput,clone({...action,kind}),{hasActed:actorId=>executionOrder.some(entry=>entry.actorId===actorId),nextRandom(){const roll=nextRandom(rngState);rngState=roll.rngState;return roll.value;}});
  if(JSON.stringify(handlerInput)!==handlerBefore)throw new Error(`action handler mutated battle: ${kind}`);
  if(!result?.battle||!Array.isArray(result.events))throw new Error(`invalid action result: ${kind}`);
  next=clone(result.battle);events.push(...result.events);executionOrder.push({...action,kind});
  const outcome=checkBattleResult(next);next=outcome.battle;events.push(...outcome.events);
 };
 let pending=prepared.actions.filter(action=>action.kind==='switch');
 while(pending.length&&next.phase!=='FINISHED'){const action=ranked(pending)[0];pending=pending.filter(entry=>entry.actorId!==action.actorId);execute(action);}
 pending=prepared.actions.filter(action=>action.kind==='move'&&action.mega);
 while(pending.length&&next.phase!=='FINISHED'){
  const action=ranked(pending.map(entry=>({...entry,priority:0})))[0];pending=pending.filter(entry=>entry.actorId!==action.actorId);if(actorAvailable(next,action.side,action.actorId))execute(action,'mega');
 }
 pending=prepared.actions.filter(action=>action.kind==='move');
 while(pending.length&&next.phase!=='FINISHED'){const action=ranked(pending)[0];pending=pending.filter(entry=>entry.actorId!==action.actorId);execute(action);}
 next.rngState=rngState;
 if(next.phase!=='FINISHED'){next.phase='END_TURN';next.phaseRevision=(next.phaseRevision||0)+1;}
 const committed=commitEvents(next,events);
 if(JSON.stringify(battle)!==input)throw new Error('resolveActionQueue mutated its input');
 return {ok:true,queue:executionOrder,...committed};
}
