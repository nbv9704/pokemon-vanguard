import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {applyVolatileStatus} from './volatile-state.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));

export function applySecondaryEffects(battle,{actorId,targetIds=[],moveId,effects=[]},runtime={}){
 let next=clone(battle),events=[];
 for(const targetId of targetIds){
  for(let index=0;index<effects.length;index++){
   const effect=effects[index],target=unitById(next,targetId);if(!target||target.hp<=0)break;
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
 const next=clone(battle),target=unitById(next,targetId),events=[];
 if(!target||target.hp<=0)return {battle:next,events};
 target.stages??={};
 for(const [stat,requestedDelta] of Object.entries(boosts||{})){
  const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;target.stages[stat]=after;
  events.push({kind:'statStageChanged',actorId,targetId,moveId,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,secondary:true});
 }
 return {battle:next,events};
}
