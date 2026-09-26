import {clone,reserveUnits,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup,requestForcedReplacement} from '../../rules-v3/lifecycle.mjs';
import {resolveHpThresholdItems} from '../item-hooks.mjs';
import {applyMechanicsSwitch} from '../switch-lifecycle.mjs';
import {applyShedTailTransfer} from '../pivot-transfer.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

export const applyShedTailHandler={
 id:'apply-shed-tail',hooks:['onMove'],
 run({battle,payload,runtime}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId),limit=maxHp(actor),reserves=reserveUnits(next,action.side);
  if(!actor||actor.hp<=0)return failed(next,payload,'actorUnavailable');
  if(actor.volatiles?.substitute)return failed(next,payload,'substituteAlreadyActive');
  if(!reserves.length)return failed(next,payload,'invalidSwitchTarget');
  if(!action.calledBy&&(typeof action.switchToId!=='string'||!reserves.some(unit=>unit.actorId===action.switchToId)))return failed(next,payload,'invalidSwitchTarget');
  const cost=Math.ceil(limit/2);if(actor.hp<=cost)return failed(next,payload,'insufficientHp');
  const paid=applyHpGroup(next,[{actorId:actor.actorId,delta:-cost}],`move:${move.id}:hp-cost`);next=paid.battle;const events=paid.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id,source:'shed-tail-cost'}));
  const threshold=resolveHpThresholdItems(next,{actorIds:[actor.actorId],trigger:`move:${move.id}:hp-cost`});next=threshold.battle;events.push(...threshold.events);
  const subHp=Math.max(1,Math.floor(limit/4));
  if(action.calledBy&&!action.switchToId){const requested=requestForcedReplacement(next,{actorId:actor.actorId,reason:'called-move-pivot',replacementState:{kind:'shed-tail',moveId:move.id,sourceId:actor.actorId,subHp}});if(!requested.requested)return failed(battle,payload,requested.reason||'invalidSwitchTarget');events.push({kind:'forcedReplacementRequested',actorId:actor.actorId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot,reason:'called-move-pivot'});return {battle:requested.battle,payload:{...payload,shedTailApplied:true,pivotSucceeded:true,deferredPivot:true},events};}
  const switched=applyMechanicsSwitch(next,action.side,actor.actorId,action.switchToId,{manifests:runtime?.abilityManifests??null});if(!switched.ok)return failed(battle,payload,'invalidSwitchTarget');
  const transfer=applyShedTailTransfer(switched.battle,{sourceId:actor.actorId,targetId:action.switchToId,subHp,moveId:move.id});events.push(...switched.events.map(event=>({...event,pivot:true,source:move.id})),...transfer.events);
  return {battle:transfer.battle,payload:{...payload,shedTailApplied:true,pivotSucceeded:true},events};
 }
};
function failed(battle,payload,reason){return {battle:clone(battle),payload:{...payload,shedTailApplied:false,pivotSucceeded:false},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason}]};}
