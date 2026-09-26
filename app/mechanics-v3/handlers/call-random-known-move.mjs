import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {callableKnownMoves} from '../called-moves.mjs';

export const callRandomKnownMoveHandler={
 id:'call-random-known-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),candidates=callableKnownMoves(actor,runtime.moveManifests,{kind:'sleep-talk',callerMoveId:payload.move.id});
  if(!candidates.length)return {battle:next,payload,events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'noCallableKnownMove'}]};
  if(typeof runtime.nextRandom!=='function'||typeof runtime.callMove!=='function')throw new Error('call-random-known-move requires seeded runtime');
  const moveId=candidates[Math.min(candidates.length-1,Math.floor(runtime.nextRandom()*candidates.length))],called=runtime.callMove({battle:next,actorId:payload.action.actorId,moveId,target:'auto',calledByMoveId:payload.move.id,recordGlobal:false});
  return {battle:called.battle,payload:{...payload,calledMoveId:moveId},events:[{kind:'moveCalled',actorId:payload.action.actorId,moveId:payload.move.id,calledMoveId:moveId,reason:'sleep-talk'},...called.events]};
 }
};
