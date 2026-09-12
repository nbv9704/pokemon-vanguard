import {applyPositionSwap} from '../switching.mjs';

export const applyPositionSwapHandler={
 id:'apply-position-swap',hooks:['onMove'],
 run({battle,payload,runtime}){
  const {action,move}=payload,result=applyPositionSwap(battle,{side:action.side,actorId:action.actorId,moveId:move.id},runtime);
  return {battle:result.battle,payload:{...payload,positionSwapSucceeded:result.succeeded},events:result.events};
 }
};
