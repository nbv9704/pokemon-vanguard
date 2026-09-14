import {resolveReactiveSwitchItems} from '../item-hooks.mjs';

export const resolveReactiveSwitchItemsHandler={
 id:'resolve-reactive-switch-items',hooks:['onMove'],
 run({battle,payload,runtime}){
  const {action,move,mechanics}=payload;
  const result=resolveReactiveSwitchItems(battle,{actorId:action.actorId,move,mechanics,damagedTargetIds:payload.damagedTargetIds||[]},runtime);
  return {battle:result.battle,payload,events:result.events};
 }
};
