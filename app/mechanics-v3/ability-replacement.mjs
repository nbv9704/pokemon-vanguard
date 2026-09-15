import {activeUnits,clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {compilePassiveEffects} from './passive-effects.mjs';

const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');
const itemEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind!=='ability');
const DEFAULT_BLOCKED=new Set(['disguise','forecast','hunger-switch','imposter','stance-change','zero-to-hero']);

export function activeAbilityId(unit){
 return unit?.activeAbilityId||abilityEffects(unit)[0]?.sourceId||unit?.buildSnapshot?.abilityId||null;
}

function blocked(effect,abilityId){
 return DEFAULT_BLOCKED.has(abilityId)||(effect?.blockedAbilityIds||[]).includes(abilityId);
}

function canAdopt(manifests,effect,abilityId){
 return Boolean(abilityId&&!blocked(effect,abilityId)&&manifests?.abilities?.[abilityId]);
}

function rememberOriginal(unit){
 unit.abilityState??={};
 if(!unit.abilityState.transientAbility)unit.abilityState.transientAbility={originalAbilityId:activeAbilityId(unit)};
}

function applyAbility(unit,abilityId,manifests){
 unit.activeAbilityId=abilityId;
 unit.passiveEffects=[...compilePassiveEffects({abilityId,manifests}),...itemEffects(unit)];
}

export function replaceActiveAbility(battle,{actorId,abilityId,manifests,effect=null,sourceId=null,reason='ability-replace'}={}){
 const next=clone(battle),unit=unitById(next,actorId),before=activeAbilityId(unit);
 if(!unit||unit.hp<=0||before===abilityId||!canAdopt(manifests,effect,abilityId))return {battle:next,replaced:false,events:[]};
 rememberOriginal(unit);applyAbility(unit,abilityId,manifests);
 return {battle:next,replaced:true,events:[{kind:'abilityChanged',actorId,targetId:actorId,sourceId:sourceId||actorId,abilityId,previousAbilityId:before,reason}]};
}

export function swapActiveAbilities(battle,{leftId,rightId,manifests,effect=null,sourceId=null,reason='ability-swap'}={}){
 const next=clone(battle),left=unitById(next,leftId),right=unitById(next,rightId);
 if(!left||!right||left.hp<=0||right.hp<=0)return {battle:next,swapped:false,events:[]};
 const leftAbility=activeAbilityId(left),rightAbility=activeAbilityId(right);
 if(!leftAbility||!rightAbility||leftAbility===rightAbility||!canAdopt(manifests,effect,rightAbility)||!canAdopt(manifests,effect,leftAbility))return {battle:next,swapped:false,events:[]};
 rememberOriginal(left);rememberOriginal(right);applyAbility(left,rightAbility,manifests);applyAbility(right,leftAbility,manifests);
 return {battle:next,swapped:true,events:[
  {kind:'abilityChanged',actorId:left.actorId,targetId:left.actorId,sourceId:sourceId||right.actorId,abilityId:rightAbility,previousAbilityId:leftAbility,reason},
  {kind:'abilityChanged',actorId:right.actorId,targetId:right.actorId,sourceId:sourceId||left.actorId,abilityId:leftAbility,previousAbilityId:rightAbility,reason}
 ]};
}

export function restoreTransientAbility(unit,manifests){
 const state=unit?.abilityState?.transientAbility;if(!state?.originalAbilityId||!manifests?.abilities?.[state.originalAbilityId])return [];
 const previousAbilityId=activeAbilityId(unit);if(previousAbilityId===state.originalAbilityId){delete unit.abilityState.transientAbility;return [];}
 applyAbility(unit,state.originalAbilityId,manifests);delete unit.abilityState.transientAbility;
 return [{kind:'abilityRestored',actorId:unit.actorId,abilityId:state.originalAbilityId,previousAbilityId,reason:'switch-out'}];
}

function chooseCandidate(next,candidates){
 if(!candidates.length)return null;if(candidates.length===1)return candidates[0];const roll=nextRandom(next.rngState);next.rngState=roll.rngState;return candidates[Math.min(candidates.length-1,Math.floor(roll.value*candidates.length))];
}

export function resolveEntryAbilityCopies(battle,{actorId,manifests}={}){
 let next=clone(battle);const unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,events:[]};
 const effect=abilityEffects(unit).find(entry=>entry.kind==='entry-ability-copy');if(!effect)return {battle:next,events:[]};
 const side=['A','B'].find(candidate=>next.sides?.[candidate]?.active?.includes(actorId));if(!side)return {battle:next,events:[]};
 const candidates=activeUnits(next,otherSide(side)).map(entry=>entry.unit).filter(target=>target.hp>0&&canAdopt(manifests,effect,activeAbilityId(target))&&activeAbilityId(target)!==activeAbilityId(unit));
 const target=chooseCandidate(next,candidates);if(!target)return {battle:next,events:[]};
 const copied=activeAbilityId(target),result=replaceActiveAbility(next,{actorId,abilityId:copied,manifests,effect,sourceId:target.actorId,reason:'entry-ability-copy'});next=result.battle;
 return {battle:next,events:result.replaced?[{kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:target.actorId,copiedAbilityId:copied},...result.events]:[]};
}

export function resolveAllyFaintAbilityCopies(battle,{faintedId,manifests}={}){
 let next=clone(battle),events=[];const fainted=unitById(next,faintedId);if(!fainted||fainted.hp>0)return {battle:next,events};
 const side=['A','B'].find(candidate=>next.sides?.[candidate]?.roster?.some(unit=>unit.actorId===faintedId));if(!side)return {battle:next,events};
 const inherited=activeAbilityId(fainted);if(!inherited)return {battle:next,events};
 for(const {unit} of activeUnits(next,side)){
  if(unit.actorId===faintedId||unit.hp<=0)continue;const current=unitById(next,unit.actorId),effect=abilityEffects(current).find(entry=>entry.kind==='ally-faint-ability-copy');if(!effect||!canAdopt(manifests,effect,inherited)||inherited===activeAbilityId(current))continue;
  const result=replaceActiveAbility(next,{actorId:current.actorId,abilityId:inherited,manifests,effect,sourceId:faintedId,reason:'ally-faint-ability-copy'});next=result.battle;if(result.replaced)events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:faintedId,copiedAbilityId:inherited},...result.events);
 }
 return {battle:next,events};
}

export function resolveFaintAbilityCopiesFromEvents(battle,events=[],{manifests}={}){
 let next=clone(battle),output=[];if(!manifests)return {battle:next,events:output};
 const ids=[...new Set((events||[]).filter(event=>event?.kind==='fainted'&&event.targetId).map(event=>event.targetId))];
 for(const faintedId of ids){const copied=resolveAllyFaintAbilityCopies(next,{faintedId,manifests});next=copied.battle;output.push(...copied.events);}
 return {battle:next,events:output};
}

export function resolveContactAbilityReplacement(battle,{attackerId,targetId,move,mechanics,damage=0,manifests}={}){
 let next=clone(battle),events=[];if(!(damage>0)||mechanics?.contact!==true)return {battle:next,events};
 const attacker=unitById(next,attackerId),target=unitById(next,targetId);if(!attacker||!target||attacker.hp<=0)return {battle:next,events};
 const swapEffect=abilityEffects(target).find(effect=>effect.kind==='contact-ability-swap');
 if(swapEffect){const result=swapActiveAbilities(next,{leftId:attackerId,rightId:targetId,manifests,effect:swapEffect,sourceId:targetId,reason:'contact-ability-swap'});next=result.battle;if(result.swapped)events.push({kind:'abilityTriggered',sourceId:targetId,abilityId:swapEffect.sourceId,effectId:swapEffect.kind,targetId:attackerId,moveId:move?.id},...result.events);return {battle:next,events};}
 const replaceEffect=abilityEffects(target).find(effect=>effect.kind==='contact-ability-replace');if(!replaceEffect)return {battle:next,events};
 const result=replaceActiveAbility(next,{actorId:attackerId,abilityId:replaceEffect.replacementAbilityId||replaceEffect.sourceId,manifests,effect:replaceEffect,sourceId:targetId,reason:'contact-ability-replace'});next=result.battle;if(result.replaced)events.push({kind:'abilityTriggered',sourceId:targetId,abilityId:replaceEffect.sourceId,effectId:replaceEffect.kind,targetId:attackerId,moveId:move?.id},...result.events);
 return {battle:next,events};
}
