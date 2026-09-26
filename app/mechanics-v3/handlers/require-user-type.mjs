import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const requireUserTypeHandler={
 id:'require-user-type',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),has=actor?.types?.includes(params.type);
  if(actor&&actor.hp>0&&has)return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:actor?.hp>0?'requiredUserType':'actorUnavailable',requiredType:params.type}]};
 }
};
