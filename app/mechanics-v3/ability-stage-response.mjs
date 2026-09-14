import {clone,unitById} from '../rules-v3/battle-state.mjs';

const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

function applyBoosts(unit,effect,{trigger,targetId=null}={}){
 const events=[];unit.stages??={};
 for(const [stat,requestedDelta] of Object.entries(effect.boosts||{})){
  const before=Number.isInteger(unit.stages[stat])?unit.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;unit.stages[stat]=after;
  events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:unit.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger,...(targetId?{sourceTargetId:targetId}:{})});
 }
 return events;
}

export function resolveStatDropResponseAbilities(battle,{sourceId,targetId,changes=[],trigger='stat-drop'}={}){
 const next=clone(battle),target=unitById(next,targetId),events=[];if(!target||target.hp<=0||sourceId===targetId||!changes.some(change=>change?.appliedDelta<0))return {battle:next,events};
 const sourceSide=sideOf(next,sourceId),targetSide=sideOf(next,targetId);if(!sourceSide||!targetSide||sourceSide===targetSide)return {battle:next,events};
 for(const effect of abilityEffects(target,'stat-drop-response')){
  events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:sourceId,trigger});
  events.push(...applyBoosts(target,effect,{trigger,targetId:sourceId}));
 }
 return {battle:next,events};
}

export function resolveFlinchResponseAbilities(battle,{actorId}={}){
 const next=clone(battle),unit=unitById(next,actorId),events=[];if(!unit||unit.hp<=0)return {battle:next,events};
 for(const effect of abilityEffects(unit,'flinch-stat-boost')){
  events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'flinch'});
  events.push(...applyBoosts(unit,{...effect,boosts:{[effect.stat]:effect.stages}},{trigger:'flinch'}));
 }
 return {battle:next,events};
}
