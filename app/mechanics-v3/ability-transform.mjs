import {activeUnits,clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {activeAbilityId} from './ability-replacement.mjs';

const abilityEffects=(unit,kind=null)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&(!kind||effect.kind===kind));
const itemEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind!=='ability');
const stages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const snapshot=value=>clone(value);

function transformSnapshot(unit){
 return {speciesId:unit.speciesId,name:unit.name,spriteKey:unit.spriteKey,types:snapshot(unit.types||[]),stats:snapshot(unit.stats||{}),maxHp:unit.maxHp,pp:snapshot(unit.pp||{}),maxPp:snapshot(unit.maxPp||{}),stages:snapshot(unit.stages||stages()),activeAbilityId:unit.activeAbilityId||null,passiveEffects:snapshot(unit.passiveEffects||[]),buildMoveIds:snapshot(unit.buildSnapshot?.moveIds||[])};
}

export function transformBlockedReason(source,target){
 if(!source||source.hp<=0||!target||target.hp<=0||source.actorId===target.actorId)return 'invalidTarget';
 if(source.transformState)return 'alreadyTransformed';
 if(target.transformState)return 'targetTransformed';
 if(target.illusionState)return 'targetIllusion';
 if(target.volatiles?.substitute)return 'targetSubstitute';
 return null;
}

export function applyTransformState(battle,{actorId,targetId,source='transform'}={}){
 const next=clone(battle),unit=unitById(next,actorId),target=unitById(next,targetId),reason=transformBlockedReason(unit,target);
 if(reason)return {battle:next,transformed:false,events:[{kind:'transformFailed',actorId,targetId,source,reason}]};
 unit.transformState={original:transformSnapshot(unit),targetId,source};
 const ownHpStat=unit.stats?.hp,ownMaxHp=unit.maxHp,ownHp=unit.hp,copiedAbility=activeAbilityId(target),copiedMoveIds=Object.keys(target.pp||{});
 unit.speciesId=target.speciesId;unit.name=target.name;unit.spriteKey=target.spriteKey;unit.types=snapshot(target.types||[]);
 unit.stats={...snapshot(target.stats||{}),...(Number.isInteger(ownHpStat)?{hp:ownHpStat}:{})};unit.maxHp=ownMaxHp;unit.hp=ownHp;
 unit.stages=snapshot(target.stages||stages());unit.pp={};unit.maxPp={};
 for(const moveId of copiedMoveIds){const max=Math.max(1,Math.min(5,target.maxPp?.[moveId]??5));unit.pp[moveId]=max;unit.maxPp[moveId]=max;}
 unit.buildSnapshot??={};unit.buildSnapshot.moveIds=[...copiedMoveIds];unit.activeAbilityId=copiedAbility;
 unit.passiveEffects=[...snapshot(abilityEffects(target)),...itemEffects(unit)];
 return {battle:next,transformed:true,events:[{kind:'transformed',actorId,targetId,source,speciesId:target.speciesId,abilityId:copiedAbility,moveIds:[...copiedMoveIds]}]};
}

export function restoreTransformState(unit){
 const state=unit?.transformState?.original;if(!state)return [];
 const previousSpeciesId=unit.speciesId;unit.speciesId=state.speciesId;unit.name=state.name;unit.spriteKey=state.spriteKey;unit.types=snapshot(state.types);unit.stats=snapshot(state.stats);unit.maxHp=state.maxHp;unit.pp=snapshot(state.pp);unit.maxPp=snapshot(state.maxPp);unit.stages=snapshot(state.stages);unit.activeAbilityId=state.activeAbilityId;unit.passiveEffects=snapshot(state.passiveEffects);unit.buildSnapshot??={};unit.buildSnapshot.moveIds=snapshot(state.buildMoveIds);delete unit.transformState;
 return [{kind:'transformEnded',actorId:unit.actorId,fromSpeciesId:previousSpeciesId,toSpeciesId:unit.speciesId,reason:'switch-out'}];
}

export function resolveEntryTransformAbility(battle,{actorId,slot=0}={}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,events:[]};
 const effect=abilityEffects(unit,'entry-transform')[0];if(!effect)return {battle:next,events:[]};
 const side=['A','B'].find(candidate=>next.sides?.[candidate]?.active?.includes(actorId));if(!side)return {battle:next,events:[]};
 const target=activeUnits(next,otherSide(side)).find(entry=>entry.slot===slot)?.unit;if(!target)return {battle:next,events:[]};
 const result=applyTransformState(next,{actorId,targetId:target.actorId,source:`ability:${effect.sourceId}`});
 return {battle:result.battle,events:result.transformed?[{kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:target.actorId},...result.events]:result.events};
}

export function resolveEntryIllusionAbility(battle,{actorId}={}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,events:[]};const effect=abilityEffects(unit,'entry-illusion')[0];if(!effect)return {battle:next,events:[]};
 const side=['A','B'].find(candidate=>next.sides?.[candidate]?.roster?.some(mon=>mon.actorId===actorId));if(!side)return {battle:next,events:[]};
 const disguise=[...(next.sides[side].roster||[])].reverse().find(mon=>mon.actorId!==actorId&&mon.hp>0);if(!disguise)return {battle:next,events:[]};
 unit.illusionState={abilityId:effect.sourceId,sourceActorId:disguise.actorId,speciesId:disguise.speciesId,name:disguise.name,spriteKey:disguise.spriteKey,types:snapshot(disguise.types||[])};
 return {battle:next,events:[{kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:disguise.actorId},{kind:'illusionStarted',actorId,abilityId:effect.sourceId,displaySpeciesId:disguise.speciesId,displayName:disguise.name}]};
}

export function breakIllusionOnDamage(battle,{targetId,sourceId=null,moveId=null}={}){
 const next=clone(battle),unit=unitById(next,targetId);if(sourceId===targetId||!unit?.illusionState)return {battle:next,broken:false,events:[]};const state=unit.illusionState;delete unit.illusionState;
 return {battle:next,broken:true,events:[{kind:'illusionBroken',actorId:targetId,abilityId:state.abilityId,...(moveId?{moveId}:{})}]};
}

export function clearIllusionState(unit){if(!unit?.illusionState)return [];const abilityId=unit.illusionState.abilityId;delete unit.illusionState;return [{kind:'illusionEnded',actorId:unit.actorId,abilityId,reason:'switch-out'}];}
