import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {applyVolatileStatus} from './volatile-state.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {abilityBlocksSecondaryEffects,abilityStatDropBlock,applyAbilityStatDropReflection} from './ability-hooks.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {opponentAbilitiesIgnoredFor} from './ability-targeting.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));

export function applySecondaryEffects(battle,{actorId,targetIds=[],moveId,effects=[],mechanics=null,hitSucceeded=false},runtime={}){
 let next=clone(battle),events=[];
 const targetEffects=effects.filter(effect=>effect.target!=='self'),selfEffects=effects.filter(effect=>effect.target==='self');
 for(const targetId of targetIds){
  for(let index=0;index<targetEffects.length;index++){
   const effect=targetEffects[index],target=unitById(next,targetId);if(!target||target.hp<=0)break;
   const ignoreTargetAbility=opponentAbilitiesIgnoredFor(next,actorId,targetId,mechanics),bypassSecondaryImmunity=effect.bypassSecondaryImmunityWhenSpread===true&&targetIds.length>1;
   if(!ignoreTargetAbility&&!bypassSecondaryImmunity&&abilityBlocksSecondaryEffects(target)){events.push({kind:'secondaryEffectBlocked',actorId,targetId,moveId,abilityId:target.passiveEffects.find(entry=>entry.sourceKind==='ability'&&entry.kind==='secondary-effect-immunity')?.sourceId});break;}
   if(effect.chance<100){if(typeof runtime.nextRandom!=='function')throw new Error('secondary effect resolution requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance/100)continue;}
   const applied=applySecondaryEffect(next,{actorId,targetId,moveId,effect,ignoreTargetAbility},runtime);next=applied.battle;events.push(...applied.events);
  }
 }
 if(hitSucceeded&&selfEffects.length&&unitById(next,actorId)?.hp>0){
  for(const effect of selfEffects){
   if(effect.chance<100){if(typeof runtime.nextRandom!=='function')throw new Error('secondary effect resolution requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance/100)continue;}
   const applied=applySecondaryEffect(next,{actorId,targetId:actorId,moveId,effect,ignoreTargetAbility:false},runtime);next=applied.battle;events.push(...applied.events);
  }
 }
 return {battle:next,events};
}

function applySecondaryEffect(battle,{actorId,targetId,moveId,effect,ignoreTargetAbility=false},runtime){
 if(effect.kind==='major-status')return applyMajorStatus(battle,{actorId,targetId,moveId,status:effect.status,blockedTargetTypes:effect.blockedTargetTypes||[],ignoreTargetAbility},runtime);
 if(effect.kind==='random-major-status'){if(typeof runtime.nextRandom!=='function')throw new Error('random major status requires seeded nextRandom');const statuses=effect.statuses||[],status=statuses[Math.floor(runtime.nextRandom()*statuses.length)];return applyMajorStatus(battle,{actorId,targetId,moveId,status,ignoreTargetAbility},runtime);}
 if(effect.kind==='cure-major-status'){const next=clone(battle),target=unitById(next,targetId),status=target?.status?.id||target?.status||null;if(!target||target.hp<=0||!status||!(effect.statuses||[]).includes(status))return {battle:next,events:[]};target.status=null;return {battle:next,events:[{kind:'statusCured',actorId,targetId,moveId,status,source:`move:${moveId}`,secondary:true}]};}
 if(effect.kind==='volatile-status')return applyVolatileStatus(battle,{actorId,targetId,moveId,volatile:effect.volatile,ignoreTargetAbility},runtime);
 if(effect.kind==='stat-stages')return applySecondaryStatStages(battle,{actorId,targetId,moveId,boosts:effect.boosts,ignoreTargetAbility});
 throw new Error(`unsupported secondary effect kind: ${effect.kind}`);
}

function applySecondaryStatStages(battle,{actorId,targetId,moveId,boosts,ignoreTargetAbility=false}){
 let next=clone(battle);const target=unitById(next,targetId),events=[];
 if(!target||target.hp<=0)return {battle:next,events};
 target.stages??={};
 for(const [stat,rawDelta] of Object.entries(boosts||{})){
  const changed=ignoreTargetAbility?{requestedDelta:rawDelta,originalRequestedDelta:rawDelta,sourceAbilityId:null}:abilityStageChange(target,rawDelta),requestedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
  const reflection=ignoreTargetAbility?{battle:next,reflected:false,events:[],resetActorIds:[]}:applyAbilityStatDropReflection(next,{sourceId:actorId,targetId,stat,requestedDelta,moveId,trigger:'secondary'});if(reflection.reflected){next=reflection.battle;events.push(...reflection.events);if(reflection.resetActorIds.length){const reflectedReset=resolveNegativeStageResetItems(next,{actorIds:reflection.resetActorIds,trigger:`ability:mirror-armor:secondary-stat-reflect`});next=reflectedReset.battle;events.push(...reflectedReset.events);}continue;}
  const block=ignoreTargetAbility?null:abilityStatDropBlock(target,{battle:next,sourceId:actorId,stat,requestedDelta});if(block){events.push({kind:'statStageBlocked',actorId,targetId,moveId,stat,requestedDelta,secondary:true,...block});continue;}
  const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;target.stages[stat]=after;
  events.push({kind:'statStageChanged',actorId,targetId,moveId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,secondary:true});
 }
 const changes=events.filter(event=>event.kind==='statStageChanged'),response=ignoreTargetAbility?{battle:next,events:[]}:resolveStatDropResponseAbilities(next,{sourceId:actorId,targetId,changes,trigger:'secondary'});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId,changes,trigger:'secondary'});next=copied.battle;events.push(...copied.events);
 const reset=resolveNegativeStageResetItems(next,{actorIds:[targetId],trigger:`move:${moveId}:secondary-stat-change`});next=reset.battle;events.push(...reset.events);
 return {battle:next,events};
}
