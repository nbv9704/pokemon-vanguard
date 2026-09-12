import {applySideGuard} from '../protection.mjs';

export const applySideProtectionHandler={
 id:'apply-side-protection',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  const {action,move}=payload,result=applySideGuard(battle,{side:action.side,actorId:action.actorId,moveId:move.id,guard:params.guard},runtime);
  return {battle:result.battle,payload:{...payload,protectionSucceeded:result.succeeded},events:result.events};
 }
};
