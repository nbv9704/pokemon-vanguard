import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';

export const requireTargetStatusHandler={
 id:'require-target-status',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId),statuses=params.statuses||[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  const target=targets[0]&&unitById(next,targets[0].actorId),status=target?.status?.id||target?.status||null;
  if(!target||target.hp<=0||!statuses.includes(status))return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,...(target?{targetId:target.actorId}:{}),moveId:move.id,reason:'targetStatusRequirement',requiredStatuses:[...statuses],actualStatus:status}]};
  return {battle:next,payload:{...payload,requiredStatusTargetId:target.actorId},events:[]};
 }
};
