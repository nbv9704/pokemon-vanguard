import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {healingWithHeldItems} from '../item-hooks.mjs';

export const applyDrainHandler={
 id:'apply-drain',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),totalDamage=payload.totalDamage||0;
  if(!actor||actor.hp<=0||actor.hp>=actor.maxHp||totalDamage<=0)return {battle:next,payload,events:[]};
  const baseRequested=Math.max(1,Math.round(totalDamage*params.numerator/params.denominator)),requested=healingWithHeldItems(baseRequested,actor,next,{source:'drain'}),hpBefore=actor.hp,amount=Math.min(actor.maxHp-hpBefore,requested);actor.hp+=amount;
  return {battle:next,payload:{...payload,drainHealing:amount},events:[{kind:'heal',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,source:'drain',hpBefore,hpAfter:actor.hp,amount}]};
 }
};
