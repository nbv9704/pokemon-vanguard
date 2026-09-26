import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const scheduleSlotHealHandler={
 id:'schedule-slot-heal',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),events=[];if(!actor||actor.hp<=0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const slot=next.sides?.[action.side]?.active?.indexOf(actor.actorId);if(slot<0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'actorNotActive'}]};
  next.sides[action.side].slotEffects??={};next.sides[action.side].slotEffects[String(slot)]??={};const bucket=next.sides[action.side].slotEffects[String(slot)],effectId=params.effect||'wish';if(bucket[effectId])return {battle:next,payload,events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'slotEffectAlreadyActive',effect:effectId}]};
  const maxHp=actor.maxHp??actor.stats?.hp,amount=Math.max(1,Math.floor(maxHp*(params.numerator??1)/(params.denominator??2))),turns=params.turns??2;bucket[effectId]={id:effectId,sourceId:move.id,sourceActorId:actor.actorId,remaining:turns,amount};events.push({kind:'slotEffectScheduled',actorId:actor.actorId,side:action.side,slot,moveId:move.id,effect:effectId,remaining:turns,amount});return {battle:next,payload,events};
 }
};
