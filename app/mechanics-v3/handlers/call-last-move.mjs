import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {calledMoveBlocked} from '../called-moves.mjs';

const fail=(battle,payload,reason,extra={})=>({battle:clone(battle),payload:{...payload},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason,...extra}]});

export const callLastMoveHandler={
 id:'call-last-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const prior=battle.lastMoveUsed,moveId=prior?.moveId;
  if(!moveId||calledMoveBlocked(runtime.moveManifests,moveId,{kind:'copycat',callerMoveId:payload.move.id}))return fail(battle,payload,'noCallableLastMove',moveId?{blockedMoveId:moveId}:{});
  if(typeof runtime.callMove!=='function')throw new Error('call-last-move requires callMove runtime');
  const called=runtime.callMove({battle,actorId:payload.action.actorId,moveId,target:'auto',calledByMoveId:payload.move.id,recordGlobal:false});
  return {battle:called.battle,payload:{...payload,calledMoveId:moveId},events:[{kind:'moveCalled',actorId:payload.action.actorId,moveId:payload.move.id,calledMoveId:moveId,reason:'copycat'},...called.events]};
 }
};
