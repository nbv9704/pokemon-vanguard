import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {typeEffectiveness} from '../../rules-v3/type-chart.mjs';
import {applySurvivalItemToMoveDamage,resolveContactDamageItems,resolveHpThresholdItems} from '../item-hooks.mjs';

export const fixedDamageHandler={
 id:'deal-fixed-damage',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;
  for(const targetRef of targets){
   let target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;const effectiveness=typeEffectiveness(move.type,target.types),hpBefore=target.hp,requested=params.formula==='user-level'?(next.level||50):Math.max(1,Math.floor(target.hp/params.denominator)),rawDamage=effectiveness===0?0:Math.min(hpBefore,requested);
   const survival=rawDamage>0?applySurvivalItemToMoveDamage(next,{targetId:target.actorId,damage:rawDamage,moveId:move.id}):{battle:next,damage:rawDamage,events:[]};next=survival.battle;events.push(...survival.events);target=unitById(next,targetRef.actorId);const amount=Math.min(hpBefore,survival.damage);target.hp-=amount;totalDamage+=amount;const breakdown={fixed:true,formula:params.formula,requested,...(survival.itemId?{itemSurvival:{sourceKind:'item',sourceId:survival.itemId,originalDamage:rawDamage,adjustedDamage:amount}}:{})};events.push({kind:'damage',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,hpBefore,hpAfter:target.hp,amount,effectiveness,breakdown});
   if(amount>0){const contact=resolveContactDamageItems(next,{attackerId:actor.actorId,targetId:target.actorId,moveId:move.id,mechanics,damage:amount});next=contact.battle;events.push(...contact.events);}
   const currentTarget=unitById(next,target.actorId);if(currentTarget?.hp===0)events.push({kind:'fainted',targetId:currentTarget.actorId,source:move.id});else if(amount>0){const threshold=resolveHpThresholdItems(next,{actorIds:[target.actorId],trigger:`fixed:${move.id}`});next=threshold.battle;events.push(...threshold.events);}
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId)},events};
 }
};
