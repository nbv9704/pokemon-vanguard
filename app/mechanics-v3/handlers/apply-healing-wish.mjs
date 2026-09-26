import {clone,reserveUnits,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';

const activeSlot=(battle,side,actorId)=>battle.sides?.[side]?.active?.indexOf(actorId)??-1;

export const applyHealingWishHandler={
 id:'apply-healing-wish',hooks:['onMove'],
 run({battle,payload}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId),slot=activeSlot(next,action.side,action.actorId);
  if(!actor||actor.hp<=0||slot<0)return {battle:next,payload:{...payload,healingWishApplied:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(!reserveUnits(next,action.side).some(unit=>unit.hp>0))return {battle:next,payload:{...payload,healingWishApplied:false},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noReserve'}]};
  next.sides[action.side].slotEffects??={};const bucket=next.sides[action.side].slotEffects[String(slot)]??={};next.sides[action.side].slotEffects[String(slot)]=bucket;
  if(bucket['healing-wish'])return {battle:next,payload:{...payload,healingWishApplied:false},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'healingWishAlreadyPending',side:action.side,slot}]};
  bucket['healing-wish']={id:'healing-wish',sourceId:move.id,sourceActorId:actor.actorId};
  const fainted=applyHpGroup(next,[{actorId:actor.actorId,delta:-actor.hp}],'healing-wish');next=fainted.battle;
  const events=[{kind:'slotEffectScheduled',actorId:actor.actorId,side:action.side,slot,moveId:move.id,effect:'healing-wish'},...fainted.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id,reason:'healingWish'}))];
  return {battle:next,payload:{...payload,healingWishApplied:true,selfSacrificed:true},events};
 }
};
