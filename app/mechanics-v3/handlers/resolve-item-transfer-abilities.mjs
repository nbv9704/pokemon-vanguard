import {resolvePostMoveItemTransferAbilities} from '../ability-item-transfer.mjs';

export const resolveItemTransferAbilitiesHandler={
 id:'resolve-item-transfer-abilities',hooks:['onMove'],
 run({battle,payload}){
  const result=resolvePostMoveItemTransferAbilities(battle,{actorId:payload.action?.actorId,move:payload.move,mechanics:payload.mechanics,damagedTargetIds:payload.damagedTargetIds||[]});
  return {battle:result.battle,payload,events:result.events};
 }
};
