import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {BATTLE_STAGES} from '../manifest-contract.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export const resetStatStagesHandler={
 id:'reset-stat-stages',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,resetStageTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  let targetIds=[];
  if(params.scope==='all-active')targetIds=['A','B'].flatMap(side=>activeUnits(next,side).map(entry=>entry.actorId));
  else if(params.scope==='damaged-targets')targetIds=[...new Set(payload.damagedTargetIds||[])];
  else throw new Error(`unsupported reset-stat-stages scope: ${params.scope}`);
  const events=[];
  for(const actorId of targetIds){const target=unitById(next,actorId);if(!target||target.hp<=0)continue;target.stages??={};const before=Object.fromEntries(BATTLE_STAGES.map(stat=>[stat,Number.isInteger(target.stages[stat])?target.stages[stat]:0]));for(const stat of BATTLE_STAGES)target.stages[stat]=0;events.push({kind:'statStagesReset',actorId:actor.actorId,targetId:target.actorId,side:sideOf(next,target.actorId),moveId:move.id,before,after:Object.fromEntries(BATTLE_STAGES.map(stat=>[stat,0]))});}
  return {battle:next,payload:{...payload,resetStageTargetIds:targetIds},events};
 }
};
