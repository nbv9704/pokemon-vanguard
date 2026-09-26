import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const reorderPendingActionHandler={
 id:'reorder-pending-action',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,actionReordered:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(next.format==='single'||next.activeCount===1)return {battle:next,payload:{...payload,actionReordered:false},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'singleBattle'}]};
  const targetId=(payload.hitTargetIds||[])[0];if(!targetId)return {battle:next,payload:{...payload,actionReordered:false},events:[]};
  const pending=runtime?.pendingActionFor?.(targetId);if(!pending||pending.kind!=='move')return {battle:next,payload:{...payload,actionReordered:false},events:[{kind:'moveFailed',actorId:actor.actorId,targetId,moveId:move.id,reason:'targetHasNoPendingMove'}]};
  if(typeof runtime?.reorderPendingAction!=='function')throw new Error('reorder-pending-action requires queue reorder runtime');
  const position=params.position;if(!['front','back'].includes(position))throw new Error(`unsupported pending action position: ${position}`);
  const reordered=runtime.reorderPendingAction(targetId,position)===true;
  return {battle:next,payload:{...payload,actionReordered:reordered,reorderedTargetId:reordered?targetId:null},events:reordered?[{kind:'pendingActionReordered',actorId:actor.actorId,targetId,moveId:move.id,position}]:[{kind:'moveFailed',actorId:actor.actorId,targetId,moveId:move.id,reason:'targetHasNoPendingMove'}]};
 }
};
