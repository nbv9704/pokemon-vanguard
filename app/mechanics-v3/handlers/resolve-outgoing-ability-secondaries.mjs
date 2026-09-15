import {resolveOutgoingAbilitySecondaries} from '../ability-outgoing.mjs';

export const resolveOutgoingAbilitySecondariesHandler={
 id:'resolve-outgoing-ability-secondaries',hooks:['onMove'],
 run({battle,payload,runtime}){
  const result=resolveOutgoingAbilitySecondaries(battle,{actorId:payload.action?.actorId,move:payload.move,mechanics:payload.mechanics,damagedTargetIds:payload.damagedTargetIds||[]},runtime);
  return {battle:result.battle,payload,events:result.events};
 }
};
