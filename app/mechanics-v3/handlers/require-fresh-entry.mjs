import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const requireFreshEntryHandler={
 id:'require-fresh-entry',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),state=actor?.volatiles?.['fresh-entry'],eligible=state?state.eligibleTurn===next.turn:next.turn===1;
  if(actor?.hp>0&&eligible)return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'freshEntryRequired',eligibleTurn:state?.eligibleTurn??1,currentTurn:next.turn}]};
 }
};
