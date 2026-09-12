import {applyForcedSwitches} from '../switching.mjs';

export const applyForcedSwitchHandler={
 id:'apply-forced-switch',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  const {action,move}=payload,result=applyForcedSwitches(battle,{actorId:action.actorId,targetIds:payload.hitTargetIds||payload.targetIds||[],moveId:move.id,requireDamage:params.requireDamage===true,totalDamage:payload.totalDamage||0},runtime);
  return {battle:result.battle,payload:{...payload,forcedSwitchSucceeded:result.succeeded},events:result.events};
 }
};
