import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function consumeNextMoveType(battle,{actorId,move}){
 const next=clone(battle),actor=unitById(next,actorId),state=actor?.volatiles?.['next-move-type'];
 if(!actor||!state||move.id==='struggle')return {battle:next,move,events:[]};
 delete actor.volatiles['next-move-type'];
 if(!state.moveType||state.moveType===move.type)return {battle:next,move,events:[{kind:'volatileEnded',actorId,volatile:'next-move-type',reason:'consumed'}]};
 return {battle:next,move:{...move,type:state.moveType},events:[{kind:'moveTypeChanged',actorId,moveId:move.id,fromType:move.type,toType:state.moveType,reason:'next-move-type'},{kind:'volatileEnded',actorId,volatile:'next-move-type',reason:'consumed'}]};
}
