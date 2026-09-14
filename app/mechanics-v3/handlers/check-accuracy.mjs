import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {resolveProtectionBlock} from '../protection.mjs';
import {semiInvulnerabilityInteraction} from '../semi-invulnerability.mjs';
import {abilityForcesHit,abilityIncomingAccuracyModifier,abilityOutgoingAccuracyModifier,resolveTargetAbilityBlock} from '../ability-hooks.mjs';
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
  const targets=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(!targets.length)return {battle:next,payload:{...payload,accuracyResolved:true,resolvedTargetIds:[],hitTargetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const hitTargetIds=[],events=[];
  for(const targetRef of targets){
   const target=unitById(next,targetRef.actorId);if(!target||target.hp<=0)continue;
   const abilityAlwaysHits=abilityForcesHit(actor)||abilityForcesHit(target),semi=target.actorId===actor.actorId?{active:false,blocked:false}:semiInvulnerabilityInteraction(target,move.id);if(semi.blocked&&!abilityAlwaysHits){events.push({kind:'moveMissed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'semiInvulnerable',semiInvulnerable:semi.mode});continue;}
   const protection=target.actorId===actor.actorId?null:resolveProtectionBlock(next,{targetRef,actorId:actor.actorId,move,mechanics},runtime);if(protection?.blocked){next=protection.battle;events.push(...protection.events);continue;}
   const abilityBlock=target.actorId===actor.actorId?null:resolveTargetAbilityBlock(next,{actorId:actor.actorId,targetId:target.actorId,move,mechanics});if(abilityBlock?.blocked){next=abilityBlock.battle;events.push(...abilityBlock.events);continue;}
   const alwaysHits=abilityAlwaysHits||(params.alwaysHitsForUserTypes||[]).some(type=>(actor.types||[]).includes(type));
   const stagedAccuracy=effectiveAccuracy(move.accuracy,actor.stages?.accuracy||0,target.stages?.evasion||0),outgoingAccuracy=stagedAccuracy===null?null:Math.min(100,Math.max(1,Math.floor(stagedAccuracy*abilityOutgoingAccuracyModifier(actor,move)))),abilityAccuracy=outgoingAccuracy===null?null:Math.max(1,Math.floor(outgoingAccuracy*abilityIncomingAccuracyModifier(target,next)));
   const chance=alwaysHits?null:accuracyWithHeldItems(abilityAccuracy,actor,next,{target,targetHasActed:runtime?.hasActed?.(target.actorId)===true,targetWillMove:typeof runtime?.willMove==='function'?runtime.willMove(target.actorId):null});
   const hit=chance===null||chance>=100||(typeof runtime.nextRandom==='function'&&runtime.nextRandom()<chance/100);
   if(chance!==null&&chance<100&&typeof runtime.nextRandom!=='function')throw new Error('check-accuracy requires seeded nextRandom');
   if(hit)hitTargetIds.push(target.actorId);
   else events.push({kind:'moveMissed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,effectiveAccuracy:chance});
  }
  return {battle:next,payload:{...payload,accuracyResolved:true,resolvedTargetIds:targets.map(target=>target.actorId),hitTargetIds},events};
 }
};
