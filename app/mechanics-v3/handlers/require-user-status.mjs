import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const requireUserStatusHandler={
 id:'require-user-status',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),current=actor?.status?.id||actor?.status||null,statuses=params.statuses||[];
  if(actor?.hp>0&&statuses.includes(current))return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'userStatusRequirement',requiredStatuses:[...statuses],currentStatus:current}]};
 }
};
