import {applyProtect} from '../protection.mjs';

export const applyProtectionHandler={
 id:'apply-protection',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  const {action,move}=payload,result=applyProtect(battle,{actorId:action.actorId,moveId:move.id,retaliation:params.retaliation||null,blocksStatus:params.blocksStatus!==false},runtime);
  return {battle:result.battle,payload:{...payload,protectionSucceeded:result.succeeded},events:result.events};
 }
};
