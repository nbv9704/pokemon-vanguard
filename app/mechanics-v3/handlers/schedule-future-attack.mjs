import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';

const sideAndSlot=(battle,actorId)=>{for(const side of ['A','B']){const slot=battle.sides?.[side]?.active?.indexOf(actorId)??-1;if(slot>=0)return {side,slot};}return null;};

export const scheduleFutureAttackHandler={
 id:'schedule-future-attack',hooks:['onMove'],
 run({battle,payload,params={}}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,futureAttackScheduled:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  const target=targets.map(ref=>unitById(next,ref.actorId)).find(unit=>unit?.hp>0);if(!target)return {battle:next,payload:{...payload,futureAttackScheduled:false},events:[]};
  const ref=sideAndSlot(next,target.actorId);if(!ref)return {battle:next,payload:{...payload,futureAttackScheduled:false},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'targetUnavailable'}]};
  next.sides[ref.side].slotEffects??={};const bucket=next.sides[ref.side].slotEffects[String(ref.slot)]??={};next.sides[ref.side].slotEffects[String(ref.slot)]=bucket;
  const effect=params.effect||'future-attack';if(bucket[effect])return {battle:next,payload:{...payload,futureAttackScheduled:false},events:[{kind:'moveFailed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'futureAttackAlreadyPending',side:ref.side,slot:ref.slot}]};
  const turns=Number.isInteger(params.turns)?params.turns:3;bucket[effect]={id:effect,sourceId:move.id,sourceActorId:actor.actorId,remaining:turns};
  return {battle:next,payload:{...payload,futureAttackScheduled:true},events:[{kind:'slotEffectScheduled',actorId:actor.actorId,targetId:target.actorId,side:ref.side,slot:ref.slot,moveId:move.id,effect,remaining:turns}]};
 }
};
