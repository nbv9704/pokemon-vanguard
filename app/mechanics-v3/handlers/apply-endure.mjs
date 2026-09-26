import {applyEndure} from '../protection.mjs';

export const applyEndureHandler={
 id:'apply-endure',hooks:['onMove'],
 run({battle,payload,runtime}){
  const {action,move}=payload,result=applyEndure(battle,{actorId:action.actorId,moveId:move.id},runtime);
  return {battle:result.battle,payload:{...payload,endureSucceeded:result.succeeded},events:result.events};
 }
};
