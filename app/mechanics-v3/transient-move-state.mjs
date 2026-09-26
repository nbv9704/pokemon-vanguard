import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function consumeTransientMoveState(battle,{actorId,move}){
 const next=clone(battle),unit=unitById(next,actorId),events=[];if(!unit||!move)return {battle:next,events};
 for(const [id,state] of Object.entries(unit.volatiles||{})){
  const damageConsumed=state?.consumeOnDamagingMove===true&&move.category!=='status',typeConsumed=Array.isArray(state?.consumeOnMoveTypes)&&state.consumeOnMoveTypes.includes(move.type)&&!(state.excludeMoveIds||[]).includes(move.id);
  if(!damageConsumed&&!typeConsumed)continue;delete unit.volatiles[id];events.push({kind:'volatileEnded',actorId:unit.actorId,volatile:id,reason:'moveConsumed',moveId:move.id});
 }
 return {battle:next,events};
}
