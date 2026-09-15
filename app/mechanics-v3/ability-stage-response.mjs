import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

function applyBoosts(unit,effect,{trigger,targetId=null}={}){
 const events=[];unit.stages??={};
 for(const [stat,rawDelta] of Object.entries(effect.boosts||{})){
  const changed=abilityStageChange(unit,rawDelta),requestedDelta=changed.requestedDelta,before=Number.isInteger(unit.stages[stat])?unit.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;unit.stages[stat]=after;
  if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
  events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:unit.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,appliedDelta,originalRequestedDelta:changed.originalRequestedDelta,reason:appliedDelta===0?'stageLimit':null,trigger,...(targetId?{sourceTargetId:targetId}:{})});
 }
 return events;
}

export function resolveStatDropResponseAbilities(battle,{sourceId,targetId,changes=[],trigger='stat-drop'}={}){
 let next=clone(battle),target=unitById(next,targetId);const events=[];if(!target||target.hp<=0||sourceId===targetId||!changes.some(change=>change?.appliedDelta<0))return {battle:next,events};
 const sourceSide=sideOf(next,sourceId),targetSide=sideOf(next,targetId);if(!sourceSide||!targetSide||sourceSide===targetSide)return {battle:next,events};
 for(const effect of abilityEffects(target,'stat-drop-response')){
  events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:sourceId,trigger});
  const boostEvents=applyBoosts(target,effect,{trigger,targetId:sourceId});events.push(...boostEvents);
  const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:target.actorId,changes:boostEvents,trigger:`ability:${effect.sourceId}:${trigger}`});next=copied.battle;events.push(...copied.events);target=unitById(next,targetId);
 }
 return {battle:next,events};
}

export function resolveFlinchResponseAbilities(battle,{actorId}={}){
 let next=clone(battle),unit=unitById(next,actorId);const events=[];if(!unit||unit.hp<=0)return {battle:next,events};
 for(const effect of abilityEffects(unit,'flinch-stat-boost')){
  events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'flinch'});
  const boostEvents=applyBoosts(unit,{...effect,boosts:{[effect.stat]:effect.stages}},{trigger:'flinch'});events.push(...boostEvents);
  const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:unit.actorId,changes:boostEvents,trigger:`ability:${effect.sourceId}:flinch`});next=copied.battle;events.push(...copied.events);unit=unitById(next,actorId);
 }
 return {battle:next,events};
}

export function resolveOpponentStatGainCopyAbilities(battle,{targetId,changes=[],trigger='stat-gain'}={}){
 let next=clone(battle),events=[];const target=unitById(next,targetId);if(!target||target.hp<=0)return {battle:next,events};
 const targetSide=sideOf(next,targetId),positive=changes.filter(change=>change?.kind==='statStageChanged'&&change.appliedDelta>0);if(!targetSide||!positive.length)return {battle:next,events};
 for(const side of ['A','B']){
  if(side===targetSide)continue;
  for(const {unit:entry} of activeUnits(next,side)){
   const holder=unitById(next,entry.actorId);if(!holder||holder.hp<=0)continue;
   for(const effect of abilityEffects(holder,'opponent-stat-gain-copy')){
    const boosts=Object.fromEntries(positive.map(change=>[change.stat,change.appliedDelta]));
    events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId,trigger});
    events.push(...applyBoosts(holder,{...effect,boosts},{trigger:`copy:${trigger}`,targetId}));
   }
  }
 }
 return {battle:next,events};
}
