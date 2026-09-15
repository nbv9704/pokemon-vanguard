import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {resolveProtectionBlock} from '../protection.mjs';
import {semiInvulnerabilityInteraction} from '../semi-invulnerability.mjs';
import {abilityForcesHit,abilityIncomingAccuracyModifier,abilityOutgoingAccuracyModifier,resolveTargetAbilityBlock} from '../ability-hooks.mjs';
import {opponentAbilitiesIgnoredFor,statusMoveReflectionForTarget} from '../ability-targeting.mjs';
import {substituteBlocksStatusMove} from '../substitute.mjs';
import {abilityIgnoresOpponentStage} from '../ability-stage-change.mjs';
import {accuracyWithHeldItems} from '../item-hooks.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));

export function effectiveAccuracy(baseAccuracy,accuracyStage=0,evasionStage=0){
 if(baseAccuracy===null)return null;
 if(!Number.isInteger(baseAccuracy)||baseAccuracy<1||baseAccuracy>100)throw new Error('move accuracy must be null or an integer from 1 to 100');
 const stage=clampStage(clampStage(accuracyStage)-clampStage(evasionStage));
 return Math.min(100,Math.trunc(stage>=0?baseAccuracy*(3+stage)/3:baseAccuracy*3/(3-stage)));
}

export const checkAccuracyHandler={
 id:'check-accuracy',hooks:['onMove'],
 run({battle,payload,params={},runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,accuracyResolved:true,resolvedTargetIds:[],hitTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if(!targets.length)return {battle:next,payload:{...payload,accuracyResolved:true,resolvedTargetIds:[],hitTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const hitTargetIds=[],reflectedStatusHits=[],events=[];
  for(const targetRef of targets){
   const target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;
   const ignoreTargetAbility=opponentAbilitiesIgnoredFor(next,actor.actorId,target.actorId,mechanics),abilityAlwaysHits=abilityForcesHit(actor)||(!ignoreTargetAbility&&abilityForcesHit(target)),semi=target.actorId===actor.actorId?{active:false,blocked:false}:semiInvulnerabilityInteraction(target,move.id);if(semi.blocked&&!abilityAlwaysHits){events.push({kind:'moveMissed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'semiInvulnerable',semiInvulnerable:semi.mode});continue;}
   const protection=target.actorId===actor.actorId?null:resolveProtectionBlock(next,{targetRef,actorId:actor.actorId,move,mechanics},runtime);if(protection?.blocked){next=protection.battle;events.push(...protection.events);continue;}
   if(target.actorId!==actor.actorId&&substituteBlocksStatusMove(target,actor,move,mechanics)){events.push({kind:'moveBlocked',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'substitute'});continue;}
   const abilityBlock=target.actorId===actor.actorId||ignoreTargetAbility?null:resolveTargetAbilityBlock(next,{actorId:actor.actorId,targetId:target.actorId,move,mechanics});if(abilityBlock?.blocked){next=abilityBlock.battle;events.push(...abilityBlock.events);continue;}
   const alwaysHits=abilityAlwaysHits||(params.alwaysHitsForUserTypes||[]).some(type=>(actor.types||[]).includes(type));
   const accuracyStage=!ignoreTargetAbility&&abilityIgnoresOpponentStage(target,'accuracy','defending')?0:(actor.stages?.accuracy||0),evasionStage=abilityIgnoresOpponentStage(actor,'evasion','attacking')?0:(target.stages?.evasion||0),stagedAccuracy=effectiveAccuracy(move.accuracy,accuracyStage,evasionStage),outgoingAccuracy=stagedAccuracy===null?null:Math.min(100,Math.max(1,Math.floor(stagedAccuracy*abilityOutgoingAccuracyModifier(actor,move)))),abilityAccuracy=outgoingAccuracy===null?null:Math.max(1,Math.floor(outgoingAccuracy*abilityIncomingAccuracyModifier(target,next,{ignoreAbility:ignoreTargetAbility})));
   const chance=alwaysHits?null:accuracyWithHeldItems(abilityAccuracy,actor,next,{target,targetHasActed:runtime?.hasActed?.(target.actorId)===true,targetWillMove:typeof runtime?.willMove==='function'?runtime.willMove(target.actorId):null});
   const hit=chance===null||chance>=100||(typeof runtime.nextRandom==='function'&&runtime.nextRandom()<chance/100);
   if(chance!==null&&chance<100&&typeof runtime.nextRandom!=='function')throw new Error('check-accuracy requires seeded nextRandom');
   if(hit){
    const reflected=statusMoveReflectionForTarget(next,{actorId:actor.actorId,targetId:target.actorId,move,mechanics});
    if(reflected){
     events.push(
      {kind:'abilityTriggered',sourceId:reflected.unit.actorId,abilityId:reflected.effect.sourceId,effectId:reflected.effect.kind,targetId:actor.actorId,moveId:move.id},
      {kind:'moveReflected',actorId:actor.actorId,targetId:reflected.unit.actorId,reflectedById:reflected.unit.actorId,moveId:move.id,abilityId:reflected.effect.sourceId}
     );
     const reflectedAlwaysHits=abilityForcesHit(reflected.unit)||abilityForcesHit(actor),reflectedAccuracyStage=abilityIgnoresOpponentStage(actor,'accuracy','defending')?0:(reflected.unit.stages?.accuracy||0),reflectedEvasionStage=abilityIgnoresOpponentStage(reflected.unit,'evasion','attacking')?0:(actor.stages?.evasion||0),reflectedStagedAccuracy=effectiveAccuracy(move.accuracy,reflectedAccuracyStage,reflectedEvasionStage),reflectedOutgoingAccuracy=reflectedStagedAccuracy===null?null:Math.min(100,Math.max(1,Math.floor(reflectedStagedAccuracy*abilityOutgoingAccuracyModifier(reflected.unit,move)))),reflectedAbilityAccuracy=reflectedOutgoingAccuracy===null?null:Math.max(1,Math.floor(reflectedOutgoingAccuracy*abilityIncomingAccuracyModifier(actor,next))),reflectedChance=reflectedAlwaysHits?null:accuracyWithHeldItems(reflectedAbilityAccuracy,reflected.unit,next,{target:actor,targetHasActed:runtime?.hasActed?.(actor.actorId)===true,targetWillMove:typeof runtime?.willMove==='function'?runtime.willMove(actor.actorId):null}),reflectedHit=reflectedChance===null||reflectedChance>=100||(typeof runtime.nextRandom==='function'&&runtime.nextRandom()<reflectedChance/100);
     if(reflectedChance!==null&&reflectedChance<100&&typeof runtime.nextRandom!=='function')throw new Error('check-accuracy requires seeded nextRandom');
     if(reflectedHit)reflectedStatusHits.push({sourceId:reflected.unit.actorId,targetId:actor.actorId,abilityId:reflected.effect.sourceId,effectId:reflected.effect.kind});
     else events.push({kind:'moveMissed',actorId:reflected.unit.actorId,targetId:actor.actorId,moveId:move.id,effectiveAccuracy:reflectedChance,reflected:true});
    }else hitTargetIds.push(target.actorId);
   }else events.push({kind:'moveMissed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,effectiveAccuracy:chance});
  }
  return {battle:next,payload:{...payload,accuracyResolved:true,resolvedTargetIds:targets.map(target=>target.actorId),hitTargetIds,reflectedStatusHits},events};
 }
};
