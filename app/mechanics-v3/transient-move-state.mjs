import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function consumeTransientMoveState(battle,{actorId,move}){
 const next=clone(battle),unit=unitById(next,actorId),events=[];if(!unit||move?.category==='status')return {battle:next,events};
 for(const [id,state] of Object.entries(unit.volatiles||{})){
  if(state?.consumeOnDamagingMove!==true)continue;delete unit.volatiles[id];events.push({kind:'volatileEnded',actorId:unit.actorId,volatile:id,reason:'moveConsumed',moveId:move?.id});
 }
 return {battle:next,events};
}
