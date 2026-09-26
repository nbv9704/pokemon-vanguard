import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {BATTLE_STAGES} from '../manifest-contract.mjs';
import {resolveNegativeStageResetItems} from '../item-hooks.mjs';
import {abilityStatDropBlock,applyAbilityStatDropReflection,resolveTargetAbilityBlock} from '../ability-hooks.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from '../ability-stage-response.mjs';
import {abilityStageChange} from '../ability-stage-change.mjs';
import {opponentAbilitiesIgnoredFor} from '../ability-targeting.mjs';
import {effectiveWeatherForUnit} from '../ability-field.mjs';
import {activeAbilityId} from '../ability-replacement.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));
const boostsFor=(battle,params,actor)=>params.weatherBoosts?.[effectiveWeatherForUnit(battle,actor)]||params.boosts;

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
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId),boosts=boostsFor(next,params,actor);validateBoosts(boosts);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(params.requireDamage&&!(payload.totalDamage>0))return {battle:next,payload,events:[]};
  if(params.requireTargetFainted){const fainted=(payload.damagedTargetIds||[]).some(id=>unitById(next,id)?.hp===0);if(!fainted)return {battle:next,payload,events:[]};}
  let targets=params.target==='self'?[{actorId:actor.actorId}]:params.target==='active-allies'?activeUnits(next,action.side).map(({unit})=>({actorId:unit.actorId})):payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  if((params.requireTargetAbilityIds||[]).length){const allowed=new Set(params.requireTargetAbilityIds);targets=targets.filter(ref=>allowed.has(activeAbilityId(unitById(next,ref.actorId))));}
  const reflectedApplications=params.target==='self'?[]:(payload.reflectedStatusHits||[]).map(hit=>({targetRef:{actorId:hit.targetId},sourceId:hit.sourceId,reflected:true}));
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length&&!reflectedApplications.length)return {battle:next,payload:{...payload,targetIds:[]},events:[]};
  if(!targets.length&&!reflectedApplications.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const events=[],resetActorIds=[],affectedTargetIds=[],changedTargetIds=[],reflectedTargetIds=[];
  const applications=[...targets.map(targetRef=>({targetRef,sourceId:actor.actorId,reflected:false})),...reflectedApplications];
  for(const application of applications){
   const target=unitById(next,application.targetRef.actorId),source=unitById(next,application.sourceId);
   if(!target||target.hp<=0||!source||source.hp<=0)continue;
   if(params.target==='active-allies'&&target.actorId!==source.actorId){const block=resolveTargetAbilityBlock(next,{actorId:source.actorId,targetId:target.actorId,move,mechanics});if(block?.blocked){next=block.battle;events.push(...block.events);continue;}}
   const blockedType=(params.blockedTargetTypes||[]).find(type=>(target.types||[]).includes(type));if(blockedType){events.push({kind:'moveBlocked',actorId:source.actorId,targetId:target.actorId,moveId:move.id,reason:'typeImmune',type:blockedType});continue;}
   affectedTargetIds.push(target.actorId);
   target.stages??={};const targetChanges=[],ignoreTargetAbility=opponentAbilitiesIgnoredFor(next,source.actorId,target.actorId,application.reflected?{...mechanics,opponentAbilitiesIgnored:false,statusMoveReflected:true}:mechanics);
   for(const [stat,rawDelta] of Object.entries(boosts)){
    const changed=ignoreTargetAbility?{requestedDelta:rawDelta,originalRequestedDelta:rawDelta,sourceAbilityId:null}:abilityStageChange(target,rawDelta),requestedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
    const reflection=ignoreTargetAbility?{battle:next,reflected:false,events:[],resetActorIds:[]}:applyAbilityStatDropReflection(next,{sourceId:source.actorId,targetId:target.actorId,stat,requestedDelta,moveId:move.id,trigger:application.reflected?'reflected':'primary'});if(reflection.reflected){next=reflection.battle;events.push(...reflection.events);resetActorIds.push(...reflection.resetActorIds);reflectedTargetIds.push(target.actorId);continue;}
    const block=ignoreTargetAbility?null:abilityStatDropBlock(target,{battle:next,sourceId:source.actorId,stat,requestedDelta});if(block){events.push({kind:'statStageBlocked',actorId:source.actorId,targetId:target.actorId,moveId:move.id,stat,requestedDelta,...block});continue;}
    const before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;
    target.stages[stat]=after;if(appliedDelta!==0)changedTargetIds.push(target.actorId);
    const change={kind:'statStageChanged',actorId:source.actorId,targetId:target.actorId,moveId:move.id,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null};events.push(change);targetChanges.push(change);
   }
   const response=ignoreTargetAbility?{battle:next,events:[]}:resolveStatDropResponseAbilities(next,{sourceId:source.actorId,targetId:target.actorId,changes:targetChanges,trigger:application.reflected?'reflected':'primary'});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:target.actorId,changes:targetChanges,trigger:'primary'});next=copied.battle;events.push(...copied.events);
  }
  if(!events.length)return {battle:next,payload:{...payload,targetIds:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const reset=resolveNegativeStageResetItems(next,{actorIds:[...new Set([...affectedTargetIds,...resetActorIds])],trigger:`move:${move.id}:primary-stat-change`});next=reset.battle;events.push(...reset.events);
  if(params.requireChange===true&&!changedTargetIds.length){for(let index=events.length-1;index>=0;index-=1)if(events[index]?.kind==='statStageChanged'&&events[index].appliedDelta===0)events.splice(index,1);events.push({kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noStatChange'});}
  return {battle:next,payload:{...payload,targetIds:[...new Set(affectedTargetIds)],statStageChangedTargetIds:[...new Set([...(payload.statStageChangedTargetIds||[]),...changedTargetIds])],statDropReflectedTargetIds:[...new Set([...(payload.statDropReflectedTargetIds||[]),...reflectedTargetIds])]},events};
 }
};
