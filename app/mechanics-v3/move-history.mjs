import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function recordLastMove(battle,actorId,moveId){
 const next=clone(battle),unit=unitById(next,actorId);
 if(!unit)throw new Error(`unknown actor: ${actorId}`);
 unit.lastMoveId=moveId;
 return next;
}
