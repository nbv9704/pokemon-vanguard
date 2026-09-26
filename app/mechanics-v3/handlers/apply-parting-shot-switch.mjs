import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {requestForcedReplacement} from '../../rules-v3/lifecycle.mjs';
import {applyMechanicsSwitch} from '../switch-lifecycle.mjs';

export const applyPartingShotSwitchHandler={
 id:'apply-parting-shot-switch',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),{action,move,mechanics}=payload,affected=(payload.resolvedTargetIds||[])[0],statsChanged=affected&&(payload.statStageChangedTargetIds||[]).includes(affected),mirrorReflected=affected&&(payload.statDropReflectedTargetIds||[]).includes(affected);
  if(!statsChanged&&!mirrorReflected)return {battle:next,payload:{...payload,pivotSucceeded:false},events:[]};
  if(mechanics?.statusMoveReflected===true){
   const requested=requestForcedReplacement(next,{actorId:action.actorId,reason:'move-parting-shot'});if(!requested.requested)return {battle:next,payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:action.actorId,moveId:move.id,reason:requested.reason||'noReserve',reflected:true}]};
   return {battle:requested.battle,payload:{...payload,pivotSucceeded:true,partingShotSwitchActorId:action.actorId},events:[{kind:'forcedReplacementRequested',actorId:action.actorId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot,reason:'reflected-parting-shot'}]};
  }
  const actor=unitById(next,action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,pivotSucceeded:false},events:[]};
  if(action.calledBy&&!action.switchToId){const requested=requestForcedReplacement(next,{actorId:actor.actorId,reason:'called-move-pivot',replacementState:{kind:'pivot',moveId:move.id,sourceId:actor.actorId}});if(!requested.requested)return {battle:next,payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:actor.actorId,moveId:move.id,reason:requested.reason||'noReserve'}]};return {battle:requested.battle,payload:{...payload,pivotSucceeded:true,deferredPivot:true,partingShotSwitchActorId:actor.actorId},events:[{kind:'forcedReplacementRequested',actorId:actor.actorId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot,reason:'called-move-pivot'}]};}
  const switched=applyMechanicsSwitch(next,action.side,actor.actorId,action.switchToId,{manifests:runtime?.abilityManifests??null});if(!switched.ok)return {battle:next,payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:actor.actorId,moveId:move.id,reason:'invalidSwitchTarget'}]};
  return {battle:switched.battle,payload:{...payload,pivotSucceeded:true,partingShotSwitchActorId:actor.actorId},events:switched.events.map(event=>({...event,pivot:true,source:move.id,partingShot:true}))};
 }
};
