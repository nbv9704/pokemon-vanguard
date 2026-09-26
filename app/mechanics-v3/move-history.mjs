import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function recordLastMove(battle,actorId,moveId,{target=null}={}){
 const next=clone(battle),unit=unitById(next,actorId);
 if(!unit)throw new Error(`unknown actor: ${actorId}`);
 unit.lastMoveId=moveId;if(target?.side&&Number.isInteger(target?.slot))unit.lastMoveTarget={side:target.side,slot:target.slot};else delete unit.lastMoveTarget;
 return next;
}

export function recordBattleLastMove(battle,{actorId,moveId,target=null}={}){
 const next=clone(battle);next.lastMoveUsed={actorId,moveId,turn:next.turn,...(target?.side&&Number.isInteger(target?.slot)?{target:{side:target.side,slot:target.slot}}:{})};return next;
}
