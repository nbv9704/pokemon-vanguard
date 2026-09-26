import {applyGravity} from '../gravity.mjs';

export const applyGravityHandler={
 id:'apply-gravity',hooks:['onMove'],
 run({battle,payload,params={}}){
  const result=applyGravity(battle,{actorId:payload.action.actorId,moveId:payload.move.id,turns:params.turns??5});
  return {battle:result.battle,payload:{...payload,gravityApplied:result.applied},events:result.events};
 }
};
