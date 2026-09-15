import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';

export const reduceLastMovePpHandler={
 id:'reduce-last-move-pp',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),events=[],amount=params.amount??4,{action,move,mechanics}=payload;
  const ids=params.requireDamage?(payload.damagedTargetIds||[]):payload.accuracyResolved?(payload.hitTargetIds||[]):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move}).map(x=>x.actorId);
  let changed=0;
  for(const targetId of ids){const target=unitById(next,targetId);if(!target||target.hp<=0)continue;const lastMoveId=target.lastMoveId,pp=lastMoveId&&target.pp?.[lastMoveId];if(!lastMoveId||!Number.isInteger(pp)||pp<=0)continue;const after=Math.max(0,pp-amount);target.pp[lastMoveId]=after;changed++;events.push({kind:'ppReduced',actorId:action.actorId,targetId,moveId:move.id,affectedMoveId:lastMoveId,ppBefore:pp,ppAfter:after,amount:pp-after});}
  if(!changed&&params.failIfUnavailable!==false)events.push({kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noLastMovePP'});
  return {battle:next,payload:{...payload,ppReducedTargetCount:changed},events};
 }
};
