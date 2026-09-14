import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const spendPpHandler={
 id:'spend-pp',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),moveId=payload.move.id,remaining=actor?.pp?.[moveId];
  if(payload.skipPp===true)return {battle:next,payload:{...payload,ppSkipped:true},events:[{kind:'ppSpendSkipped',actorId:payload.action.actorId,moveId,reason:'twoTurnRelease'}]};
  if(!Number.isInteger(remaining))throw new Error(`missing PP state for ${payload.action.actorId}:${moveId}`);
  if(remaining<=0)return {battle:next,payload:{...payload,cancelled:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId,reason:'noPP'}]};
  actor.pp[moveId]=remaining-1;
  return {battle:next,payload:{...payload,ppBefore:remaining,ppAfter:remaining-1},events:[{kind:'ppSpent',actorId:actor.actorId,moveId,ppBefore:remaining,ppAfter:remaining-1}]};
 }
};
