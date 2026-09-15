import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveHpThresholdItems} from '../item-hooks.mjs';
import {abilityPreventsIndirectDamage,abilityPreventsRecoil} from '../ability-hooks.mjs';

export const applyRecoilHandler={
 id:'apply-recoil',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId),totalDamage=payload.totalDamage||0;
  if(!actor||actor.hp<=0||totalDamage<=0)return {battle:next,payload,events:[]};
  if(abilityPreventsRecoil(actor))return {battle:next,payload:{...payload,recoilDamage:0},events:[{kind:'abilityTriggered',sourceId:actor.actorId,abilityId:actor.passiveEffects.find(effect=>effect.sourceKind==='ability'&&effect.kind==='recoil-immunity')?.sourceId,effectId:'recoil-immunity'}]};
  const indirectGuard=move.id==='struggle'?null:abilityPreventsIndirectDamage(actor);if(indirectGuard)return {battle:next,payload:{...payload,recoilDamage:0},events:[{kind:'abilityTriggered',sourceId:actor.actorId,abilityId:indirectGuard.sourceId,effectId:indirectGuard.kind,trigger:'recoil',moveId:move.id}]};
  const requested=Math.max(1,Math.round(totalDamage*params.numerator/params.denominator)),hpBefore=actor.hp,amount=Math.min(hpBefore,requested);actor.hp-=amount;
  const events=[{kind:'damage',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,source:'recoil',hpBefore,hpAfter:actor.hp,amount}];
  if(actor.hp===0){events.push({kind:'fainted',targetId:actor.actorId,source:'recoil'});return {battle:next,payload:{...payload,recoilDamage:amount},events};}
  const threshold=resolveHpThresholdItems(next,{actorIds:[actor.actorId],trigger:`recoil:${move.id}`});next=threshold.battle;events.push(...threshold.events);
  return {battle:next,payload:{...payload,recoilDamage:amount},events};
 }
};
