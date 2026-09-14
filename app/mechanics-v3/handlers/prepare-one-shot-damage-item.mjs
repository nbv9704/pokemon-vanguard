import {prepareOneShotMoveDamageItem} from '../item-hooks.mjs';

export const prepareOneShotDamageItemHandler={
 id:'prepare-one-shot-damage-item',hooks:['onMove'],
 run({battle,payload}){
  const {action,move}=payload,targetIds=payload.hitTargetIds||payload.resolvedTargetIds||[];
  const result=prepareOneShotMoveDamageItem(battle,{actorId:action.actorId,move,targetIds});
  return {battle:result.battle,payload:{...payload,itemMoveMultiplier:result.multiplier,itemMoveItemId:result.itemId??null},events:result.events};
 }
};
