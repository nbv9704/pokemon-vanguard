import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {BATTLE_STAGES} from '../manifest-contract.mjs';

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
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(!targets.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const events=[];
  for(const targetRef of targets){
   const target=unitById(next,targetRef.actorId);
   if(!target||target.hp<=0)continue;
   target.stages??={};
   for(const [stat,requestedDelta] of Object.entries(params.boosts)){
    const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;
    target.stages[stat]=after;
    events.push({kind:'statStageChanged',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null});
   }
  }
  if(!events.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  return {battle:next,payload:{...payload,targetIds:targets.map(target=>target.actorId)},events};
 }
};
