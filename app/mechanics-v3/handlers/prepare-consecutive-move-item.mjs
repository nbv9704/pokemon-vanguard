import {prepareConsecutiveMoveItem} from '../item-hooks.mjs';

export const prepareConsecutiveMoveItemHandler={
 id:'prepare-consecutive-move-item',hooks:['onMove'],
 run({battle,payload}){
  const result=prepareConsecutiveMoveItem(battle,{actorId:payload.action?.actorId,move:payload.move});
  const current=payload.itemMoveMultiplier??1,multiplier=current*(result.multiplier??1);
  return {battle:result.battle,payload:{...payload,itemMoveMultiplier:multiplier,itemMoveItemId:result.itemId??payload.itemMoveItemId??null},events:result.events};
 }
};
