import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {applyMajorStatus} from './major-status.mjs';
import {unitIsGrounded} from './terrain.mjs';
import {abilityStatusBlock} from './ability-hooks.mjs';

export const DELAYED_EFFECT_IDS=['yawn','perish-song'];

function seededRuntime(battle){
 return {nextRandom(){const roll=nextRandom(battle.rngState);battle.rngState=roll.rngState;return roll.value;}};
}

function delayedState(effect,moveId,sourceActorId,turns){
 return {id:effect,sourceId:moveId,sourceActorId,remaining:turns};
}

function yawnScheduleBlockReason(battle,target,sourceId){
 if(target.status)return {reason:'alreadyStatus'};
 if(target.volatiles?.yawn)return {reason:'alreadyDelayed'};
 if(battle.field?.terrain?.id==='electric'&&unitIsGrounded(target))return {reason:'terrainBlocked'};
 const abilityBlock=abilityStatusBlock(battle,target,'sleep',{sourceId});if(abilityBlock)return abilityBlock;
 return null;
}

export function scheduleDelayedEffect(battle,{actorId,targetId,moveId,effect,turns}){
 if(!DELAYED_EFFECT_IDS.includes(effect))throw new Error(`unsupported delayed effect: ${effect}`);
 if(!Number.isInteger(turns)||turns<1)throw new Error('delayed effect turns must be a positive integer');
 const next=clone(battle),target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,applied:false,events:[{kind:'delayedEffectFailed',actorId,targetId,moveId,effect,reason:'targetUnavailable'}]};
 target.volatiles??={};
 if(effect==='yawn'){
  const block=yawnScheduleBlockReason(next,target,actorId);
  if(block)return {battle:next,applied:false,events:[{kind:'delayedEffectFailed',actorId,targetId,moveId,effect,reason:block.reason,...(block.sourceAbilityId?{sourceAbilityId:block.sourceAbilityId}:{})}]};
 }
 if(effect==='perish-song'&&target.volatiles[effect])return {battle:next,applied:false,events:[]};
 target.volatiles[effect]=delayedState(effect,moveId,actorId,turns);
 return {battle:next,applied:true,events:[{kind:'delayedEffectScheduled',actorId,targetId,moveId,effect,remaining:turns,...(effect==='perish-song'?{count:turns}:{})}]};
}

export function scheduleDelayedEffectForActive(battle,{actorId,moveId,effect,turns}){
 let next=clone(battle);const events=[];let applied=0;
 for(const side of ['A','B'])for(const {actorId:targetId} of activeUnits(next,side)){
  const result=scheduleDelayedEffect(next,{actorId,targetId,moveId,effect,turns});next=result.battle;events.push(...result.events);if(result.applied)applied++;
 }
 if(!applied)events.push({kind:'moveFailed',actorId,moveId,reason:'noNewTarget'});
 return {battle:next,applied:applied>0,events};
}

function resolveYawn(next,target,state,events){
 state.remaining--;
 if(state.remaining>0){events.push({kind:'delayedEffectTick',targetId:target.actorId,effect:'yawn',remaining:state.remaining});return next;}
 delete target.volatiles.yawn;
 const applied=applyMajorStatus(next,{actorId:state.sourceActorId,targetId:target.actorId,moveId:state.sourceId,status:'sleep'},seededRuntime(next));
 events.push({kind:'delayedEffectResolved',actorId:state.sourceActorId,targetId:target.actorId,moveId:state.sourceId,effect:'yawn'},...applied.events);
 return applied.battle;
}

function resolvePerishSong(next,target,state,events){
 state.remaining--;
 const count=Math.max(0,state.remaining);
 if(count>0){events.push({kind:'delayedEffectTick',targetId:target.actorId,effect:'perish-song',remaining:state.remaining,count});return next;}
 delete target.volatiles['perish-song'];
 target.hp=0;
 events.push({kind:'delayedEffectResolved',actorId:state.sourceActorId,targetId:target.actorId,moveId:state.sourceId,effect:'perish-song',count:0},{kind:'fainted',targetId:target.actorId,source:'perish-song'});
 return next;
}

export function resolveDelayedEffectsEndTurn(battle){
 let next=clone(battle);const events=[];
 // Snapshot actor IDs so simultaneous delayed effects are resolved in stable side/slot order.
 const actorIds=['A','B'].flatMap(side=>activeUnits(next,side,{includeFainted:true}).map(entry=>entry.actorId));
 for(const actorId of actorIds){
  let target=unitById(next,actorId);if(!target||target.hp<=0)continue;
  const yawn=target.volatiles?.yawn;
  if(yawn){next=resolveYawn(next,target,yawn,events);target=unitById(next,actorId);if(!target||target.hp<=0)continue;}
  const perish=target.volatiles?.['perish-song'];
  if(perish)next=resolvePerishSong(next,target,perish,events);
 }
 return {battle:next,events};
}
