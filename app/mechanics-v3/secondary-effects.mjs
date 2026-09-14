import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {applyVolatileStatus} from './volatile-state.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {abilityBlocksSecondaryEffects,abilityStatDropBlock} from './ability-hooks.mjs';
import {resolveStatDropResponseAbilities} from './ability-stage-response.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));

export function applySecondaryEffects(battle,{actorId,targetIds=[],moveId,effects=[]},runtime={}){
 let next=clone(battle),events=[];
 for(const targetId of targetIds){
  for(let index=0;index<effects.length;index++){
   const effect=effects[index],target=unitById(next,targetId);if(!target||target.hp<=0)break;
   if(abilityBlocksSecondaryEffects(target)){events.push({kind:'secondaryEffectBlocked',actorId,targetId,moveId,abilityId:target.passiveEffects.find(entry=>entry.sourceKind==='ability'&&entry.kind==='secondary-effect-immunity')?.sourceId});break;}
   if(effect.chance<100){if(typeof runtime.nextRandom!=='function')throw new Error('secondary effect resolution requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance/100)continue;}
   const applied=applySecondaryEffect(next,{actorId,targetId,moveId,effect},runtime);next=applied.battle;events.push(...applied.events);
  }
 }
 return {battle:next,events};
}

function applySecondaryEffect(battle,{actorId,targetId,moveId,effect},runtime){
 if(effect.kind==='major-status')return applyMajorStatus(battle,{actorId,targetId,moveId,status:effect.status,blockedTargetTypes:effect.blockedTargetTypes||[]},runtime);
 if(effect.kind==='volatile-status')return applyVolatileStatus(battle,{actorId,targetId,moveId,volatile:effect.volatile},runtime);
 if(effect.kind==='stat-stages')return applySecondaryStatStages(battle,{actorId,targetId,moveId,boosts:effect.boosts});
 throw new Error(`unsupported secondary effect kind: ${effect.kind}`);
}

function applySecondaryStatStages(battle,{actorId,targetId,moveId,boosts}){
 let next=clone(battle);const target=unitById(next,targetId),events=[];
 if(!target||target.hp<=0)return {battle:next,events};
 target.stages??={};
 for(const [stat,requestedDelta] of Object.entries(boosts||{})){
  const block=abilityStatDropBlock(target,{battle:next,sourceId:actorId,stat,requestedDelta});if(block){events.push({kind:'statStageBlocked',actorId,targetId,moveId,stat,requestedDelta,secondary:true,...block});continue;}
  const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;target.stages[stat]=after;
  events.push({kind:'statStageChanged',actorId,targetId,moveId,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,secondary:true});
 }
 const response=resolveStatDropResponseAbilities(next,{sourceId:actorId,targetId,changes:events.filter(event=>event.kind==='statStageChanged'),trigger:'secondary'});next=response.battle;events.push(...response.events);
 const reset=resolveNegativeStageResetItems(next,{actorIds:[targetId],trigger:`move:${moveId}:secondary-stat-change`});next=reset.battle;events.push(...reset.events);
 return {battle:next,events};
}
