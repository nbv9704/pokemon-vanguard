import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {resolveContactAbilityResponses} from '../ability-contact.mjs';
import {applyLethalHitSurvivalAbility,resolveDamageResponseAbilities,resolveKoAbilityEffects} from '../ability-damage-response.mjs';
import {applySurvivalItemToMoveDamage,resolveContactDamageItems,resolvePostDamageItems,typeEffectivenessWithHeldItems} from '../item-hooks.mjs';

export const fixedDamageHandler={
 id:'deal-fixed-damage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;const damagedTargetIds=[];
  for(const targetRef of targets){
   let target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;const effectiveness=typeEffectivenessWithHeldItems(move.type,target,next),hpBefore=target.hp,requested=params.formula==='user-level'?(next.level||50):Math.max(1,Math.floor(target.hp/params.denominator)),rawDamage=effectiveness===0?0:Math.min(hpBefore,requested);
   const abilitySurvival=rawDamage>0?applyLethalHitSurvivalAbility(next,{targetId:target.actorId,damage:rawDamage,moveId:move.id}):{battle:next,damage:rawDamage,events:[],abilityId:null};next=abilitySurvival.battle;events.push(...abilitySurvival.events);
   const survival=abilitySurvival.damage>0?applySurvivalItemToMoveDamage(next,{targetId:target.actorId,damage:abilitySurvival.damage,moveId:move.id,runtime}):{battle:next,damage:abilitySurvival.damage,events:[]};next=survival.battle;events.push(...survival.events);target=unitById(next,targetRef.actorId);const amount=Math.min(hpBefore,survival.damage);target.hp-=amount;totalDamage+=amount;if(amount>0)damagedTargetIds.push(target.actorId);const breakdown={fixed:true,formula:params.formula,requested,...(abilitySurvival.abilityId?{abilitySurvival:{sourceKind:'ability',sourceId:abilitySurvival.abilityId,originalDamage:rawDamage,adjustedDamage:abilitySurvival.damage}}:{}),...(survival.itemId?{itemSurvival:{sourceKind:'item',sourceId:survival.itemId,originalDamage:abilitySurvival.damage,adjustedDamage:amount}}:{})};events.push({kind:'damage',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,hpBefore,hpAfter:target.hp,amount,effectiveness,breakdown});
   if(amount>0){const response=resolveDamageResponseAbilities(next,{actorId:actor.actorId,targetId:target.actorId,move,damage:amount,hpBefore,hpAfter:target.hp,breakdown});next=response.battle;events.push(...response.events);const abilityContact=resolveContactAbilityResponses(next,{attackerId:actor.actorId,targetId:target.actorId,moveId:move.id,mechanics,damage:amount},runtime);next=abilityContact.battle;events.push(...abilityContact.events);const contact=resolveContactDamageItems(next,{attackerId:actor.actorId,targetId:target.actorId,moveId:move.id,mechanics,damage:amount});next=contact.battle;events.push(...contact.events);}
   if(amount>0){const item=resolvePostDamageItems(next,{targetId:target.actorId,moveId:move.id,damage:amount});next=item.battle;events.push(...item.events);}
   const finalTarget=unitById(next,target.actorId);if(finalTarget?.hp===0){const ko=resolveKoAbilityEffects(next,{actorId:actor.actorId,targetId:finalTarget.actorId,moveId:move.id});next=ko.battle;events.push(...ko.events,{kind:'fainted',targetId:finalTarget.actorId,source:move.id});}
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId),damagedTargetIds:[...new Set(damagedTargetIds)]},events};
 }
};
