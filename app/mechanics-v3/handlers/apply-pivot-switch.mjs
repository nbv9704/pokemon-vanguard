import {requestForcedReplacement} from '../../rules-v3/lifecycle.mjs';
import {applyPivotSwitch} from '../switching.mjs';

export const applyPivotSwitchHandler={
 id:'apply-pivot-switch',hooks:['onMove'],
 run({battle,payload,params}){
  const {action,move}=payload,requireDamage=params.requireDamage!==false;if(action.calledBy&&!action.switchToId){if(requireDamage&&!(payload.totalDamage>0))return {battle,payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:action.actorId,moveId:move.id,reason:'noDamage'}]};const requested=requestForcedReplacement(battle,{actorId:action.actorId,reason:'called-move-pivot',replacementState:{kind:'pivot',moveId:move.id,sourceId:action.actorId}});if(!requested.requested)return {battle,payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:action.actorId,moveId:move.id,reason:requested.reason||'noReserve'}]};return {battle:requested.battle,payload:{...payload,pivotSucceeded:true,deferredPivot:true},events:[{kind:'forcedReplacementRequested',actorId:action.actorId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot,reason:'called-move-pivot'}]};}
  const result=applyPivotSwitch(battle,{side:action.side,actorId:action.actorId,toId:action.switchToId,moveId:move.id,totalDamage:payload.totalDamage||0,requireDamage});return {battle:result.battle,payload:{...payload,pivotSucceeded:result.succeeded},events:result.events};
 }
};
