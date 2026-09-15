import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveHpThresholdItems} from '../item-hooks.mjs';

export const applyCrashDamageHandler={
 id:'apply-crash-damage',hooks:['onMove'],
 run({battle,payload,params={}}){
  let next=clone(battle);const actor=unitById(next,payload.action.actorId);
  if(!actor||actor.hp<=0||(payload.connectedTargetIds||[]).length>0)return {battle:next,payload,events:[]};
  const maxHp=actor.maxHp??actor.stats?.hp,numerator=params.numerator??1,denominator=params.denominator??2,amount=Math.max(1,Math.floor(maxHp*numerator/denominator)),hpBefore=actor.hp;actor.hp=Math.max(0,actor.hp-amount);
  const events=[{kind:'damage',actorId:actor.actorId,targetId:actor.actorId,moveId:payload.move.id,source:'crash',hpBefore,hpAfter:actor.hp,amount:hpBefore-actor.hp}];
  if(actor.hp>0){const threshold=resolveHpThresholdItems(next,{actorIds:[actor.actorId],trigger:`crash:${payload.move.id}`});next=threshold.battle;events.push(...threshold.events);}
  return {battle:next,payload:{...payload,crashDamage:hpBefore-actor.hp},events};
 }
};
