import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {hasConsumedBerry} from '../item-hooks.mjs';

export const requireBerryConsumedHandler={
 id:'require-berry-consumed',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  if(hasConsumedBerry(actor))return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:payload.move.id,reason:'berryNotConsumed'}]};
 }
};
