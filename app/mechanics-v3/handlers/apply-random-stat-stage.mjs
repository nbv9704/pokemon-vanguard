import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {abilityStageChange} from '../ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from '../ability-stage-response.mjs';
import {resolveNegativeStageResetItems} from '../item-hooks.mjs';

const clamp=value=>Math.max(-6,Math.min(6,value));

export const applyRandomStatStageHandler={
 id:'apply-random-stat-stage',hooks:['onMove'],
 run({battle,payload,params,runtime}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const refs=payload.accuracyResolved?(payload.hitTargetIds||[]).map(actorId=>({actorId})):resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  const target=refs[0]&&unitById(next,refs[0].actorId);if(!target||target.hp<=0)return {battle:next,payload,events:[]};
  const stats=(params.stats||[]).filter(stat=>(target.stages?.[stat]??0)<6);if(!stats.length)return {battle:next,payload,events:[{kind:'moveFailed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'noEligibleStat'}]};
  if(typeof runtime?.nextRandom!=='function')throw new Error('apply-random-stat-stage requires seeded nextRandom');
  const stat=stats[Math.min(stats.length-1,Math.floor(runtime.nextRandom()*stats.length))],changed=abilityStageChange(target,params.stages),requestedDelta=changed.requestedDelta,before=target.stages?.[stat]??0,after=clamp(before+requestedDelta),appliedDelta=after-before;target.stages??={};target.stages[stat]=after;
  const events=[];if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
  const change={kind:'statStageChanged',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,random:true};events.push(change);
  const response=resolveStatDropResponseAbilities(next,{sourceId:actor.actorId,targetId:target.actorId,changes:[change],trigger:'primary'});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:target.actorId,changes:[change],trigger:'primary'});next=copied.battle;events.push(...copied.events);
  const reset=resolveNegativeStageResetItems(next,{actorIds:[target.actorId],trigger:`move:${move.id}:random-stat-change`});next=reset.battle;events.push(...reset.events);
  return {battle:next,payload:{...payload,randomStatStage:{targetId:target.actorId,stat,requestedDelta,appliedDelta}},events};
 }
};
