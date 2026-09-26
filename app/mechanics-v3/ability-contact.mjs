import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {abilityPreventsIndirectDamage,abilityStatDropBlock,applyAbilityStatDropReflection,globalContactFaintResponseBlock} from './ability-hooks.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {resolveContactAbilityReplacement} from './ability-replacement.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {applyInfatuation} from './infatuation.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const contactEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind==='contact-response');

export function resolveContactAbilityResponses(battle,{attackerId,targetId,moveId,mechanics,damage=0,hit=null,ignoreTargetAbility=false}={},runtime={}){
 let next=clone(battle),events=[];if(!mechanics?.contact||damage<=0)return {battle:next,events};
 for(const effect of contactEffects(unitById(next,targetId))){
  const attacker=unitById(next,attackerId),holder=unitById(next,targetId);if(!attacker||!holder)break;
  if(effect.requireHolderFainted===true&&holder.hp>0)continue;
  if(effect.requireHolderFainted===true&&effect.response==='damage'){const damp=globalContactFaintResponseBlock(next);if(damp){events.push({kind:'abilityTriggered',sourceId:damp.holder.actorId,abilityId:damp.effect.sourceId,effectId:damp.effect.kind,targetId:attacker.actorId},{kind:'abilityResponseBlocked',sourceId:holder.actorId,abilityId:effect.sourceId,reason:'globalAbility',blockingAbilityId:damp.effect.sourceId});continue;}}
  if(effect.chance!==undefined&&effect.chance<1){if(typeof runtime.nextRandom!=='function')throw new Error('contact Ability response requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance)continue;}
  events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:attacker.actorId,...(hit===null?{}:{hit})});
  if(effect.response==='damage'){
   if(attacker.hp<=0)continue;const indirectGuard=abilityPreventsIndirectDamage(attacker);if(indirectGuard){events.push({kind:'abilityTriggered',sourceId:attacker.actorId,abilityId:indirectGuard.sourceId,effectId:indirectGuard.kind,trigger:`ability:${effect.sourceId}`});continue;}const amount=Math.max(1,Math.floor(maxHp(attacker)*effect.numerator/effect.denominator));const applied=applyHpGroup(next,[{actorId:attacker.actorId,delta:-amount}],`ability:${effect.sourceId}`);next=applied.battle;events.push(...applied.events.map(event=>({...event,actorId:holder.actorId,abilityId:effect.sourceId,reason:'contact'})));continue;
  }
  if(effect.response==='status'){
   if(attacker.hp<=0)continue;const applied=applyMajorStatus(next,{actorId:holder.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,status:effect.status},runtime);next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,reason:event.reason||'contact'})));continue;
  }
  if(effect.response==='volatile'){
   if(attacker.hp<=0)continue;const applied=applyInfatuation(next,{sourceId:holder.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,sourceAbilityId:effect.sourceId,ignoreTargetAbility:false});next=applied.battle;events.push(...applied.events);continue;
  }
  if(effect.response==='stat'){
   if(attacker.hp<=0)continue;attacker.stages??={};const stat=effect.stat,changed=abilityStageChange(attacker,effect.stages),requestedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:attacker.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
   const reflection=applyAbilityStatDropReflection(next,{sourceId:holder.actorId,targetId:attacker.actorId,sourceAbilityId:effect.sourceId,stat,requestedDelta,trigger:'contact'});if(reflection.reflected){next=reflection.battle;events.push(...reflection.events);if(reflection.resetActorIds.length){const reflectedReset=resolveNegativeStageResetItems(next,{actorIds:reflection.resetActorIds,trigger:`ability:${effect.sourceId}:contact-stat-reflect`});next=reflectedReset.battle;events.push(...reflectedReset.events);}continue;}
   const block=abilityStatDropBlock(attacker,{battle:next,sourceId:holder.actorId,sourceAbilityId:effect.sourceId,stat,requestedDelta});
   if(block){events.push({kind:'statStageBlocked',actorId:holder.actorId,targetId:attacker.actorId,abilityId:effect.sourceId,stat,requestedDelta,trigger:'contact',...block});continue;}
   const before=Number.isInteger(attacker.stages[stat])?attacker.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;attacker.stages[stat]=after;const change={kind:'statStageChanged',actorId:holder.actorId,targetId:attacker.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'contact'};events.push(change);
   const response=resolveStatDropResponseAbilities(next,{sourceId:holder.actorId,targetId:attacker.actorId,changes:[change],trigger:'contact'});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:attacker.actorId,changes:[change],trigger:'contact'});next=copied.battle;events.push(...copied.events);
   const reset=resolveNegativeStageResetItems(next,{actorIds:[attacker.actorId],trigger:`ability:${effect.sourceId}:contact-stat-change`});next=reset.battle;events.push(...reset.events);
  }
 }
 if(runtime?.abilityManifests){const changed=resolveContactAbilityReplacement(next,{attackerId,targetId,move:{id:moveId},mechanics,damage,manifests:runtime.abilityManifests});next=changed.battle;events.push(...changed.events);}
 return {battle:next,events};
}
