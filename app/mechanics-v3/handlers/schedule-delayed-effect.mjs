import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {scheduleDelayedEffect,scheduleDelayedEffectForActive} from '../delayed-effects.mjs';

export const scheduleDelayedEffectHandler={
 id:'schedule-delayed-effect',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(params.scope==='all-active'){
   const result=scheduleDelayedEffectForActive(next,{actorId:actor.actorId,moveId:move.id,effect:params.effect,turns:params.turns});
   return {battle:result.battle,payload:{...payload,targetIds:['A','B'].flatMap(side=>activeUnits(result.battle,side).map(entry=>entry.actorId))},events:result.events};
  }
  const targets=payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  for(const target of targets){const result=scheduleDelayedEffect(next,{actorId:actor.actorId,targetId:target.actorId,moveId:move.id,effect:params.effect,turns:params.turns});next=result.battle;events.push(...result.events);}
  return {battle:next,payload:{...payload,targetIds:targets.map(target=>target.actorId)},events};
 }
};
