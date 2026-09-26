import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {requestForcedReplacement} from '../../rules-v3/lifecycle.mjs';
import {applyMechanicsSwitch} from '../switch-lifecycle.mjs';
import {applyBatonPassState,captureBatonPassState} from '../pivot-transfer.mjs';

export const applyBatonPassHandler={
 id:'apply-baton-pass',hooks:['onMove'],
 run({battle,payload,runtime}){
  const {action,move}=payload,actor=unitById(battle,action.actorId);if(!actor||actor.hp<=0)return {battle:clone(battle),payload,events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const state=captureBatonPassState(actor);
  if(action.calledBy&&!action.switchToId){const requested=requestForcedReplacement(battle,{actorId:actor.actorId,reason:'called-move-pivot',replacementState:{kind:'baton-pass',moveId:move.id,sourceId:actor.actorId,state}});if(!requested.requested)return {battle:clone(battle),payload:{...payload,pivotSucceeded:false},events:[{kind:'pivotFailed',actorId:actor.actorId,moveId:move.id,reason:requested.reason||'noReserve'}]};return {battle:requested.battle,payload:{...payload,pivotSucceeded:true,deferredPivot:true},events:[{kind:'forcedReplacementRequested',actorId:actor.actorId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot,reason:'called-move-pivot'}]};}
  const switched=applyMechanicsSwitch(battle,action.side,actor.actorId,action.switchToId,{manifests:runtime?.abilityManifests??null});if(!switched.ok)return {battle:clone(battle),payload,events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'invalidSwitchTarget'}]};
  const applied=applyBatonPassState(switched.battle,{sourceId:actor.actorId,targetId:action.switchToId,state,moveId:move.id,manifests:runtime?.abilityManifests??null});
  return {battle:applied.battle,payload:{...payload,pivotSucceeded:true,batonPassTargetId:action.switchToId},events:[...switched.events.map(event=>({...event,pivot:true,source:move.id,batonPass:true})),...applied.events]};
 }
};
