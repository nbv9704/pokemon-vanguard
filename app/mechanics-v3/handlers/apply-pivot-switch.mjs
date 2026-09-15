import {applyPivotSwitch} from '../switching.mjs';

export const applyPivotSwitchHandler={
 id:'apply-pivot-switch',hooks:['onMove'],
 run({battle,payload,params}){
  const {action,move}=payload,result=applyPivotSwitch(battle,{side:action.side,actorId:action.actorId,toId:action.switchToId,moveId:move.id,totalDamage:payload.totalDamage||0,requireDamage:params.requireDamage!==false});
  return {battle:result.battle,payload:{...payload,pivotSucceeded:result.succeeded},events:result.events};
 }
};
