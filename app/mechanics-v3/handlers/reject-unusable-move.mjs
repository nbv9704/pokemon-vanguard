import {clone} from '../../rules-v3/battle-state.mjs';

export const rejectUnusableMoveHandler={
 id:'reject-unusable-move',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),{action,move}=payload;
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'moveUnusable'}]};
 }
};
