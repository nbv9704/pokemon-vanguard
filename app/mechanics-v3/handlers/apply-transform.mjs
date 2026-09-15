import {resolveTargets} from '../targets.mjs';
import {applyTransformState} from '../ability-transform.mjs';

export const applyTransformHandler={
 id:'apply-transform',hooks:['onMove'],
 run({battle,payload}){
  const {action,move,mechanics}=payload,targets=resolveTargets(battle,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:false,move}),target=targets[0];
  if(!target)return {battle,payload:{...payload,cancelled:true},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noTarget'}]};
  const result=applyTransformState(battle,{actorId:action.actorId,targetId:target.actorId,source:`move:${move.id}`});
  return {battle:result.battle,payload:{...payload,transformed:result.transformed,targetIds:[target.actorId]},events:result.events};
 }
};
