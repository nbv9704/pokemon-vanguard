import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {applyHazard} from './hazards.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {applyWeather} from './weather.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities} from './ability-stage-response.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {abilityPreventsIndirectDamage} from './ability-hooks.mjs';

const STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);

function stageEvents(unit,effect,{boosts=null,setStages=null,trigger}){
 const events=[];unit.stages??={};
 const source=setStages||boosts||{};
 for(const stat of STAGES){if(source[stat]===undefined)continue;const before=Number.isInteger(unit.stages[stat])?unit.stages[stat]:0,rawDelta=setStages?source[stat]-before:source[stat],changed=abilityStageChange(unit,rawDelta),requestedDelta=changed.requestedDelta,after=clampStage(before+requestedDelta);unit.stages[stat]=after;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:unit.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta:after-before,reason:after===before?'stageLimit':null,trigger});}
 return events;
}

function matchesDamageResponse(effect,{move,damage,hpBefore,hpAfter,breakdown},target){
 if(!(damage>0))return false;
 if(effect.requireCritical&&!(breakdown?.critical>1))return false;
 if(effect.moveType&&move?.type!==effect.moveType)return false;
 if(effect.category&&move?.category!==effect.category)return false;
 if(effect.thresholdCross){const limit=maxHp(target),{numerator,denominator}=effect.thresholdCross;if(!(hpBefore*denominator>limit*numerator&&hpAfter*denominator<=limit*numerator))return false;}
 return true;
}

export function resolveDamageResponseAbilities(battle,{actorId,targetId,move,damage=0,hpBefore=null,hpAfter=null,breakdown=null,ignoreTargetAbility=false}={},runtime={}){
 let next=clone(battle),events=[];let target=unitById(next,targetId);if(!target||ignoreTargetAbility)return {battle:next,events};
 for(const effect of abilityEffects(target,'damage-response')){
  target=unitById(next,targetId);if(!target||!matchesDamageResponse(effect,{move,damage,hpBefore,hpAfter,breakdown},target))continue;
  if((effect.boosts||effect.setStages)&&target.hp<=0)continue;
  events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:actorId});
  if(effect.boosts||effect.setStages){const changes=stageEvents(target,effect,{boosts:effect.boosts,setStages:effect.setStages,trigger:'damage'});events.push(...changes);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:target.actorId,changes,trigger:`ability:${effect.sourceId}:damage`});next=copied.battle;events.push(...copied.events);const reset=resolveNegativeStageResetItems(next,{actorIds:[target.actorId],trigger:`ability:${effect.sourceId}:damage-response`});next=reset.battle;events.push(...reset.events);continue;}
  if(effect.weather){const applied=applyWeather(next,{actorId:target.actorId,moveId:`ability:${effect.sourceId}`,weather:effect.weather,defaultTurns:effect.turns||5});next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'damage'})));continue;}
  if(effect.hazard){const applied=applyHazard(next,{actorId:target.actorId,moveId:`ability:${effect.sourceId}`,hazard:effect.hazard,allowFainted:true});next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'damage'})));continue;}
  if(effect.attackerStatus){const attacker=unitById(next,actorId);if(attacker?.hp>0){const applied=applyMajorStatus(next,{actorId:target.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,status:effect.attackerStatus},runtime);next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'damage'})));}continue;}
  if(effect.faintAttackerDamage==='hp-before'&&hpAfter===0){const attacker=unitById(next,actorId);if(!attacker||attacker.hp<=0)continue;const guard=abilityPreventsIndirectDamage(attacker);if(guard){events.push({kind:'abilityTriggered',sourceId:attacker.actorId,abilityId:guard.sourceId,effectId:guard.kind,trigger:`ability:${effect.sourceId}`});continue;}const before=attacker.hp,amount=Math.min(before,Math.max(0,hpBefore||0));attacker.hp-=amount;events.push({kind:'damage',actorId:target.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,hpBefore:before,hpAfter:attacker.hp,amount,source:'ability',abilityId:effect.sourceId});if(attacker.hp===0)events.push({kind:'fainted',targetId:attacker.actorId,source:`ability:${effect.sourceId}`});continue;}
 }
 target=unitById(next,targetId);
 if(damage>0&&target){
  for(const effect of abilityEffects(target,'damage-response-disable')){
   const attacker=unitById(next,actorId);if(!attacker||attacker.hp<=0||!move?.id||!Number.isInteger(attacker.pp?.[move.id]))continue;
   if(attacker.volatiles?.disable)continue;if(typeof runtime.nextRandom!=='function')throw new Error('damage-response-disable requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance)continue;
   attacker.volatiles??={};attacker.volatiles.disable={id:'disable',sourceId:`ability:${effect.sourceId}`,moveId:move.id,endTurnTimer:4};events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:attacker.actorId},{kind:'volatileApplied',actorId:target.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,volatile:'disable',disabledMoveId:move.id,abilityId:effect.sourceId});
  }
  if(target.hp>0)for(const effect of abilityEffects(target,'damage-charge-type')){target.abilityState??={};target.abilityState[`charge:${effect.sourceId}`]={active:true,sourceAbilityId:effect.sourceId,type:effect.type};events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:actorId},{kind:'abilityStateStarted',actorId:target.actorId,abilityId:effect.sourceId,state:'charge',type:effect.type});}
 }
 return {battle:next,events};
}

export function resolveKoAbilityEffects(battle,{actorId,targetId,moveId}={}){
 let next=clone(battle),events=[];const actor=unitById(next,actorId),target=unitById(next,targetId);if(!actor||actor.hp<=0||!target||target.hp>0)return {battle:next,events};
 for(const effect of abilityEffects(actor,'ko-stat-boost')){events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId});const changes=stageEvents(actor,effect,{boosts:{[effect.stat]:effect.stages},trigger:'knockout'});events.push(...changes);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:actor.actorId,changes,trigger:`ability:${effect.sourceId}:knockout`});next=copied.battle;events.push(...copied.events);const reset=resolveNegativeStageResetItems(next,{actorIds:[actor.actorId],trigger:`ability:${effect.sourceId}:knockout`});next=reset.battle;events.push(...reset.events);}
 return {battle:next,events};
}

export function resolveOhkoAbilityBlock(battle,{targetId,moveId,ignoreAbility=false}={}){
 const next=clone(battle),target=unitById(next,targetId);if(ignoreAbility||!target||target.hp<=0)return {battle:next,blocked:false,events:[],abilityId:null};const effect=abilityEffects(target,'lethal-hit-survival').find(entry=>entry.blocksOhko===true);if(!effect)return {battle:next,blocked:false,events:[],abilityId:null};return {battle:next,blocked:true,abilityId:effect.sourceId,events:[{kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'ohko'},{kind:'moveBlocked',targetId:target.actorId,moveId,reason:'ohkoAbility',abilityId:effect.sourceId}]};
}

export function applyLethalHitSurvivalAbility(battle,{targetId,damage,moveId,hit=null,ignoreAbility=false}={}){
 const next=clone(battle),target=unitById(next,targetId);if(ignoreAbility)return {battle:next,damage,events:[],abilityId:null};if(!target||target.hp<=0||!(damage>=target.hp))return {battle:next,damage,events:[],abilityId:null};
 const effect=abilityEffects(target,'lethal-hit-survival').find(effect=>!effect.requireFullHp||target.hp===maxHp(target));if(!effect)return {battle:next,damage,events:[],abilityId:null};
 const adjusted=Math.max(0,target.hp-1);return {battle:next,damage:adjusted,abilityId:effect.sourceId,events:[{kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,...(hit===null?{}:{hit})},{kind:'survivalTriggered',targetId:target.actorId,moveId,abilityId:effect.sourceId,hpBefore:target.hp,originalDamage:damage,adjustedDamage:adjusted}]};
}

function drawIndex(battle,length){const roll=nextRandom(battle.rngState);battle.rngState=roll.rngState;return Math.min(length-1,Math.floor(roll.value*length));}

export function resolveEndTurnAbilityStageBoosts(battle){
 let next=clone(battle),events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){let current=unitById(next,unit.actorId);if(!current||current.hp<=0)continue;
  for(const effect of abilityEffects(current,'end-turn-stat-boost')){const entryTurn=current.abilityState?.[`entryTurn:${effect.sourceId}`];if(effect.skipEntryTurn&&entryTurn===next.turn)continue;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind});const changes=stageEvents(current,effect,{boosts:{[effect.stat]:effect.stages},trigger:'end-turn'});events.push(...changes);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:current.actorId,changes,trigger:`ability:${effect.sourceId}:end-turn`});next=copied.battle;events.push(...copied.events);const reset=resolveNegativeStageResetItems(next,{actorIds:[current.actorId],trigger:`ability:${effect.sourceId}:end-turn`});next=reset.battle;events.push(...reset.events);current=unitById(next,unit.actorId);}
  for(const effect of abilityEffects(current,'end-turn-random-stat-shift')){current.stages??={};const raises=(effect.stats||[]).filter(stat=>(current.stages[stat]??0)<6);if(!raises.length)continue;const up=raises[drawIndex(next,raises.length)],lowers=(effect.stats||[]).filter(stat=>stat!==up&&(current.stages[stat]??0)>-6);const down=lowers.length?lowers[drawIndex(next,lowers.length)]:null,boosts={[up]:effect.raise};if(down)boosts[down]=effect.lower;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind,raisedStat:up,...(down?{loweredStat:down}:{})});const changes=stageEvents(current,effect,{boosts,trigger:'end-turn'});events.push(...changes);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:current.actorId,changes,trigger:`ability:${effect.sourceId}:end-turn-random-shift`});next=copied.battle;events.push(...copied.events);const reset=resolveNegativeStageResetItems(next,{actorIds:[current.actorId],trigger:`ability:${effect.sourceId}:end-turn-random-shift`});next=reset.battle;events.push(...reset.events);current=unitById(next,unit.actorId);}
 }
 return {battle:next,events};
}
