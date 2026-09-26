import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {applyMajorStatus} from './major-status.mjs';
import {unitIsGrounded} from './terrain.mjs';
import {abilityStatusBlock} from './ability-hooks.mjs';
import {applyDamageHit} from './damage-hit.mjs';

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


export function resolveSlotEffectsOnEntry(battle,switchEvents=[]){
 let next=clone(battle);const events=[];
 for(const entry of switchEvents||[]){
  if(entry?.kind!=='switchIn'||!entry.actorId||!entry.side||!Number.isInteger(entry.slot))continue;
  const bucket=next.sides?.[entry.side]?.slotEffects?.[String(entry.slot)],wish=bucket?.['healing-wish'],target=unitById(next,entry.actorId);if(!wish||!target||target.hp<=0)continue;
  const status=target.status?.id||target.status,needsHealing=target.hp<(target.maxHp??target.stats?.hp)||Boolean(status);if(!needsHealing){events.push({kind:'slotEffectDeferred',actorId:wish.sourceActorId,targetId:target.actorId,side:entry.side,slot:entry.slot,moveId:wish.sourceId,effect:'healing-wish',reason:'targetHealthy'});continue;}
  const hpBefore=target.hp,limit=target.maxHp??target.stats?.hp;target.hp=limit;target.status=null;delete bucket['healing-wish'];if(!Object.keys(bucket).length)delete next.sides[entry.side].slotEffects[String(entry.slot)];
  events.push({kind:'slotEffectResolved',actorId:wish.sourceActorId,targetId:target.actorId,side:entry.side,slot:entry.slot,moveId:wish.sourceId,effect:'healing-wish'});if(target.hp>hpBefore)events.push({kind:'heal',actorId:wish.sourceActorId,targetId:target.actorId,moveId:wish.sourceId,hpBefore,hpAfter:target.hp,amount:target.hp-hpBefore,source:'healing-wish'});if(status)events.push({kind:'statusCured',actorId:wish.sourceActorId,targetId:target.actorId,status,moveId:wish.sourceId,reason:'healing-wish'});
 }
 return {battle:next,events};
}

function resolveSlotEffectsEndTurn(battle){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const [slotKey,bucket] of Object.entries(next.sides?.[side]?.slotEffects||{})){
  const slot=Number(slotKey);if(!Number.isInteger(slot)||!bucket||typeof bucket!=='object')continue;
  const wish=bucket.wish;if(wish){wish.remaining--;if(wish.remaining>0)events.push({kind:'slotEffectTick',side,slot,effect:'wish',remaining:wish.remaining});else{delete bucket.wish;const targetId=next.sides?.[side]?.active?.[slot],target=targetId&&unitById(next,targetId);events.push({kind:'slotEffectResolved',actorId:wish.sourceActorId,targetId:target?.actorId??null,side,slot,moveId:wish.sourceId,effect:'wish'});if(target?.hp>0){const healed=applyHpGroup(next,[{actorId:target.actorId,delta:wish.amount}],'wish');next=healed.battle;events.push(...healed.events);}}}
  if(!Object.keys(bucket).length)delete next.sides[side].slotEffects[slotKey];
 }
 return {battle:next,events};
}


export function resolveFutureAttacksEndTurn(battle,{moves=null,manifests=null}={}){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const [slotKey,bucket] of Object.entries(next.sides?.[side]?.slotEffects||{})){
  const slot=Number(slotKey),future=bucket?.['future-attack'];if(!Number.isInteger(slot)||!future)continue;
  future.remaining--;
  if(future.remaining>0){events.push({kind:'slotEffectTick',side,slot,effect:'future-attack',remaining:future.remaining,moveId:future.sourceId});continue;}
  delete bucket['future-attack'];if(!Object.keys(bucket).length)delete next.sides[side].slotEffects[slotKey];
  const targetId=next.sides?.[side]?.active?.[slot]||null,target=targetId&&unitById(next,targetId),move=Array.isArray(moves)?moves.find(entry=>entry.id===future.sourceId):moves?.[future.sourceId],mechanics=manifests?.moves?.[future.sourceId]||manifests?.[future.sourceId];
  events.push({kind:'slotEffectResolved',actorId:future.sourceActorId,targetId:target?.actorId??null,side,slot,moveId:future.sourceId,effect:'future-attack'});
  if(!target||target.hp<=0||!move||!mechanics)continue;
  const rngCarrier=next,runtime=seededRuntime(rngCarrier),hit=applyDamageHit(next,{actorId:future.sourceActorId,targetId:target.actorId,move,mechanics,allowFaintedActor:true},runtime);hit.battle.rngState=rngCarrier.rngState;next=hit.battle;events.push(...hit.events.map(event=>({...event,delayedEffect:'future-attack'})));
 }
 return {battle:next,events};
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
 const slots=resolveSlotEffectsEndTurn(next);next=slots.battle;events.push(...slots.events);
 return {battle:next,events};
}
