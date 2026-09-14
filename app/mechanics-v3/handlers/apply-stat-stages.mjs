import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {BATTLE_STAGES} from '../manifest-contract.mjs';
import {resolveNegativeStageResetItems} from '../item-hooks.mjs';
import {abilityStatDropBlock} from '../ability-hooks.mjs';
import {resolveStatDropResponseAbilities} from '../ability-stage-response.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));

function validateBoosts(boosts){
 if(!boosts||typeof boosts!=='object'||Array.isArray(boosts)||!Object.keys(boosts).length)throw new Error('apply-stat-stages requires boosts');
 for(const [stat,delta] of Object.entries(boosts)){
  if(!BATTLE_STAGES.includes(stat))throw new Error(`unknown battle stage: ${stat}`);
  if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)throw new Error(`invalid stage delta for ${stat}`);
 }
}

export const applyStatStagesHandler={
 id:'apply-stat-stages',hooks:['onMove'],
 run({battle,payload,params}){
  validateBoosts(params.boosts);
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(params.requireDamage&&!(payload.totalDamage>0))return {battle:next,payload,events:[]};
  const targets=params.target==='self'?[{actorId:actor.actorId}]:payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const events=[];
  for(const targetRef of targets){
   const target=unitById(next,targetRef.actorId);
   if(!target||target.hp<=0)continue;
   target.stages??={};const targetChanges=[];
   for(const [stat,requestedDelta] of Object.entries(params.boosts)){
    const block=abilityStatDropBlock(target,{battle:next,sourceId:actor.actorId,stat,requestedDelta});if(block){events.push({kind:'statStageBlocked',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,stat,requestedDelta,...block});continue;}
    const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;
    target.stages[stat]=after;
    const change={kind:'statStageChanged',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null};events.push(change);targetChanges.push(change);
   }
   const response=resolveStatDropResponseAbilities(next,{sourceId:actor.actorId,targetId:target.actorId,changes:targetChanges,trigger:'primary'});next=response.battle;events.push(...response.events);
  }
  if(!events.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const reset=resolveNegativeStageResetItems(next,{actorIds:targets.map(target=>target.actorId),trigger:`move:${move.id}:primary-stat-change`});next=reset.battle;events.push(...reset.events);
  return {battle:next,payload:{...payload,targetIds:targets.map(target=>target.actorId)},events};
 }
};
