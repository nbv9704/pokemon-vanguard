import {resolveFlinchItems} from '../item-hooks.mjs';

export const resolveFlinchItemsHandler={
 id:'resolve-flinch-items',hooks:['onMove'],
 run({battle,payload,runtime}){
  const result=resolveFlinchItems(battle,{actorId:payload.action?.actorId,move:payload.move,mechanics:payload.mechanics,damagedTargetIds:payload.damagedTargetIds||[]},runtime);
  return {battle:result.battle,payload,events:result.events};
 }
};
