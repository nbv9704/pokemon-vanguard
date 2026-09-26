import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {calledMoveBlocked} from '../called-moves.mjs';

export const instructLastMoveHandler={
 id:'instruct-last-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),targetId=(payload.hitTargetIds||[])[0],target=unitById(next,targetId),moveId=target?.lastMoveId;
  if(!target||target.hp<=0||!moveId||calledMoveBlocked(runtime.moveManifests,moveId,{kind:'instruct',callerMoveId:payload.move.id})||!Number.isInteger(target.pp?.[moveId])||target.pp[moveId]<=0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:payload.action.actorId,...(targetId?{targetId}:{}),moveId:payload.move.id,reason:'instructUnavailable',...(moveId?{blockedMoveId:moveId}:{})}]};
  if(typeof runtime.callMove!=='function')throw new Error('instruct-last-move requires callMove runtime');
  const called=runtime.callMove({battle:next,actorId:target.actorId,moveId,target:target.lastMoveTarget??'auto',calledByMoveId:payload.move.id,recordGlobal:true});
  return {battle:called.battle,payload:{...payload,calledMoveId:moveId,preserveCalledGlobalMove:true},events:[{kind:'moveCalled',actorId:payload.action.actorId,targetId:target.actorId,moveId:payload.move.id,calledMoveId:moveId,reason:'instruct'},...called.events]};
 }
};
