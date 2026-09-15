import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {resolveContactAbilityResponses} from '../ability-contact.mjs';
import {applyLethalHitSurvivalAbility,resolveDamageResponseAbilities,resolveKoAbilityEffects} from '../ability-damage-response.mjs';
import {applySurvivalItemToMoveDamage,resolveContactDamageItems,resolvePostDamageItems,typeEffectivenessWithHeldItems} from '../item-hooks.mjs';
import {opponentAbilitiesIgnoredFor} from '../ability-targeting.mjs';
import {applyDisguiseShield} from '../ability-form.mjs';
import {applySubstituteDamage,substituteBypassed} from '../substitute.mjs';
import {resolveAllyFaintAbilityCopies} from '../ability-replacement.mjs';
import {breakIllusionOnDamage} from '../ability-transform.mjs';

export const fixedDamageHandler={
 id:'deal-fixed-damage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[],damagedTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;const damagedTargetIds=[];
  for(const targetRef of targets){
   let target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;
   const ignoreTargetAbility=opponentAbilitiesIgnoredFor(next,actor.actorId,target.actorId,mechanics),effectiveness=typeEffectivenessWithHeldItems(move.type,target,next,{attacker:actor,ignoreDefenderAbility:ignoreTargetAbility}),hpBefore=target.hp,requested=params.formula==='user-level'?(next.level||50):params.formula==='user-current-hp'?actor.hp:params.formula==='target-user-hp-difference'?Math.max(0,target.hp-actor.hp):Math.max(1,Math.floor(target.hp/params.denominator)),rawDamage=effectiveness===0?0:Math.min(hpBefore,requested);
   if(rawDamage>0&&target.volatiles?.substitute&&!substituteBypassed(actor,mechanics)){const sub=applySubstituteDamage(next,{actorId:actor.actorId,targetId:target.actorId,damage:rawDamage,moveId:move.id,mechanics});next=sub.battle;totalDamage+=sub.amount;events.push(...sub.events);continue;}
   if(rawDamage>0){const disguise=applyDisguiseShield(next,{targetId:target.actorId,damage:rawDamage,moveId:move.id,ignored:ignoreTargetAbility});if(disguise.shielded){next=disguise.battle;events.push(...disguise.events);continue;}}
   target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;
   const currentHpBefore=target.hp,abilitySurvival=rawDamage>0?applyLethalHitSurvivalAbility(next,{targetId:target.actorId,damage:Math.min(currentHpBefore,requested),moveId:move.id,ignoreAbility:ignoreTargetAbility}):{battle:next,damage:rawDamage,events:[],abilityId:null};next=abilitySurvival.battle;events.push(...abilitySurvival.events);
   const survival=abilitySurvival.damage>0?applySurvivalItemToMoveDamage(next,{targetId:target.actorId,damage:abilitySurvival.damage,moveId:move.id,runtime}):{battle:next,damage:abilitySurvival.damage,events:[]};next=survival.battle;events.push(...survival.events);target=unitById(next,targetRef.actorId);const amount=Math.min(currentHpBefore,survival.damage);target.hp-=amount;totalDamage+=amount;if(amount>0)damagedTargetIds.push(target.actorId);const breakdown={fixed:true,formula:params.formula,requested,...(abilitySurvival.abilityId?{abilitySurvival:{sourceKind:'ability',sourceId:abilitySurvival.abilityId,originalDamage:rawDamage,adjustedDamage:abilitySurvival.damage}}:{}),...(survival.itemId?{itemSurvival:{sourceKind:'item',sourceId:survival.itemId,originalDamage:abilitySurvival.damage,adjustedDamage:amount}}:{})};events.push({kind:'damage',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,hpBefore:currentHpBefore,hpAfter:target.hp,amount,effectiveness,breakdown});
   if(amount>0){const illusion=breakIllusionOnDamage(next,{targetId:target.actorId,sourceId:actor.actorId,moveId:move.id});next=illusion.battle;events.push(...illusion.events);}
   if(amount>0){const response=resolveDamageResponseAbilities(next,{actorId:actor.actorId,targetId:target.actorId,move,damage:amount,hpBefore:currentHpBefore,hpAfter:target.hp,breakdown,ignoreTargetAbility});next=response.battle;events.push(...response.events);const abilityContact=resolveContactAbilityResponses(next,{attackerId:actor.actorId,targetId:target.actorId,moveId:move.id,mechanics,damage:amount,ignoreTargetAbility},runtime);next=abilityContact.battle;events.push(...abilityContact.events);const contact=resolveContactDamageItems(next,{attackerId:actor.actorId,targetId:target.actorId,moveId:move.id,mechanics,damage:amount});next=contact.battle;events.push(...contact.events);}
   if(amount>0){const item=resolvePostDamageItems(next,{targetId:target.actorId,moveId:move.id,damage:amount});next=item.battle;events.push(...item.events);}
   const finalTarget=unitById(next,target.actorId);if(finalTarget?.hp===0){const ko=resolveKoAbilityEffects(next,{actorId:actor.actorId,targetId:finalTarget.actorId,moveId:move.id});next=ko.battle;events.push(...ko.events);if(runtime?.abilityManifests){const copied=resolveAllyFaintAbilityCopies(next,{faintedId:finalTarget.actorId,manifests:runtime.abilityManifests});next=copied.battle;events.push(...copied.events);}events.push({kind:'fainted',targetId:finalTarget.actorId,source:move.id});}
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId),damagedTargetIds:[...new Set(damagedTargetIds)]},events};
 }
};
