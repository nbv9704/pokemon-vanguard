import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';

const fail=(battle,payload,reason,extra={})=>({battle:clone(battle),payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason,...extra}]});

export const requireNotConsecutiveHandler={
 id:'require-not-consecutive',hooks:['onTryMove'],
 run({battle,payload}){const actor=unitById(battle,payload.action.actorId);if(actor?.lastUsedMoveIdSinceEntry===payload.move.id)return fail(battle,payload,'consecutiveUseBlocked');return {battle:clone(battle),payload,events:[]};}
};

export const requireOtherMovesUsedHandler={
 id:'require-other-moves-used',hooks:['onTryMove'],
 run({battle,payload}){
  const actor=unitById(battle,payload.action.actorId),known=[...new Set(actor?.buildSnapshot?.moveIds||Object.keys(actor?.pp||{}))],others=known.filter(id=>id!==payload.move.id),used=new Set(actor?.usedMoveIdsSinceEntry||[]);
  if(known.length<2||!others.length||others.some(id=>!used.has(id)))return fail(battle,payload,'otherMovesUnused',{missingMoveIds:others.filter(id=>!used.has(id))});
  return {battle:clone(battle),payload,events:[]};
 }
};

export const requirePendingDamagingActionHandler={
 id:'require-pending-damaging-action',hooks:['onTryMove'],
 run({battle,payload,params={},runtime}){
  const {action,move,mechanics}=payload,targets=resolveTargets(battle,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move}),targetId=targets[0]?.actorId,pending=targetId&&typeof runtime?.pendingActionFor==='function'?runtime.pendingActionFor(targetId):null;
  const damaging=pending?.kind==='move'&&pending.moveCategory!=='status',priorityOk=params.requirePositivePriority?Number(pending?.priority)>0:true;
  if(!targetId||!damaging||!priorityOk)return fail(battle,payload,params.requirePositivePriority?'targetNotUsingPriorityAttack':'targetNotAttacking',{...(targetId?{targetId}:{}),...(pending?.moveId?{targetMoveId:pending.moveId}:{})});
  return {battle:clone(battle),payload:{...payload,pendingTargetAction:pending},events:[{kind:'moveConditionMet',actorId:action.actorId,targetId,moveId:move.id,condition:params.requirePositivePriority?'pendingPriorityAttack':'pendingAttack',targetMoveId:pending.moveId,targetPriority:pending.priority??0}]};
 }
};
