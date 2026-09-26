import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {opponentAbilitiesIgnoredFor} from '../ability-targeting.mjs';
import {applyInfatuation} from '../infatuation.mjs';

export const applyInfatuationHandler={
 id:'apply-infatuation',hooks:['onMove'],
 run({battle,payload}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  for(const ref of targets){const target=unitById(next,ref.actorId);if(!target||target.hp<=0)continue;const applied=applyInfatuation(next,{sourceId:actor.actorId,targetId:target.actorId,moveId:move.id,ignoreTargetAbility:opponentAbilitiesIgnoredFor(next,actor.actorId,target.actorId,mechanics)});next=applied.battle;events.push(...applied.events);}
  return {battle:next,payload:{...payload,targetIds:targets.map(target=>target.actorId)},events};
 }
};
