import {resolveAfterMoveItems} from '../item-hooks.mjs';

export const resolveAfterMoveItemsHandler={
 id:'resolve-after-move-items',
 hooks:['onMove'],
 run({battle,payload}){
  const {action,move,mechanics,totalDamage=0}=payload||{};
  const resolved=resolveAfterMoveItems(battle,{actorId:action?.actorId,move,mechanics,totalDamage});
  return {battle:resolved.battle,payload,events:resolved.events};
 }
};
