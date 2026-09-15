import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {opponentAbilitiesIgnoredFor} from '../ability-targeting.mjs';
import {applyVolatileStatus} from '../volatile-state.mjs';

export const applyVolatileStatusHandler={
 id:'apply-volatile-status',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  for(const target of targets){const applied=applyVolatileStatus(next,{actorId:actor.actorId,targetId:target.actorId,moveId:move.id,volatile:params.volatile,ignoreTargetAbility:opponentAbilitiesIgnoredFor(next,actor.actorId,target.actorId,mechanics)},runtime);next=applied.battle;events.push(...applied.events);}
  return {battle:next,payload:{...payload,targetIds:targets.map(target=>target.actorId)},events};
 }
};
