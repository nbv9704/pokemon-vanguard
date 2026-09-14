import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHazard} from './hazards.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {applyWeather} from './weather.mjs';

const STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);

function stageEvents(unit,effect,{boosts=null,setStages=null,trigger}){
 const events=[];unit.stages??={};
 const source=setStages||boosts||{};
 for(const stat of STAGES){if(source[stat]===undefined)continue;const before=Number.isInteger(unit.stages[stat])?unit.stages[stat]:0,after=setStages?clampStage(source[stat]):clampStage(before+source[stat]),requestedDelta=after-before;unit.stages[stat]=after;events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:unit.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta:setStages?source[stat]-before:source[stat],appliedDelta:after-before,reason:after===before?'stageLimit':null,trigger});}
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

export function resolveDamageResponseAbilities(battle,{actorId,targetId,move,damage=0,hpBefore=null,hpAfter=null,breakdown=null}={}){
 let next=clone(battle),events=[];let target=unitById(next,targetId);if(!target)return {battle:next,events};
 for(const effect of abilityEffects(target,'damage-response')){
  target=unitById(next,targetId);if(!target||!matchesDamageResponse(effect,{move,damage,hpBefore,hpAfter,breakdown},target))continue;
  if((effect.boosts||effect.setStages)&&target.hp<=0)continue;
  events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:actorId});
  if(effect.boosts||effect.setStages){events.push(...stageEvents(target,effect,{boosts:effect.boosts,setStages:effect.setStages,trigger:'damage'}));const reset=resolveNegativeStageResetItems(next,{actorIds:[target.actorId],trigger:`ability:${effect.sourceId}:damage-response`});next=reset.battle;events.push(...reset.events);continue;}
  if(effect.weather){const applied=applyWeather(next,{actorId:target.actorId,moveId:`ability:${effect.sourceId}`,weather:effect.weather,defaultTurns:effect.turns||5});next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'damage'})));continue;}
  if(effect.hazard){const applied=applyHazard(next,{actorId:target.actorId,moveId:`ability:${effect.sourceId}`,hazard:effect.hazard,allowFainted:true});next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'damage'})));}
 }
 return {battle:next,events};
}

export function resolveKoAbilityEffects(battle,{actorId,targetId,moveId}={}){
 let next=clone(battle),events=[];const actor=unitById(next,actorId),target=unitById(next,targetId);if(!actor||actor.hp<=0||!target||target.hp>0)return {battle:next,events};
 for(const effect of abilityEffects(actor,'ko-stat-boost')){events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId});events.push(...stageEvents(actor,effect,{boosts:{[effect.stat]:effect.stages},trigger:'knockout'}));const reset=resolveNegativeStageResetItems(next,{actorIds:[actor.actorId],trigger:`ability:${effect.sourceId}:knockout`});next=reset.battle;events.push(...reset.events);}
 return {battle:next,events};
}

export function applyLethalHitSurvivalAbility(battle,{targetId,damage,moveId,hit=null}={}){
 const next=clone(battle),target=unitById(next,targetId);if(!target||target.hp<=0||!(damage>=target.hp))return {battle:next,damage,events:[],abilityId:null};
 const effect=abilityEffects(target,'lethal-hit-survival').find(effect=>!effect.requireFullHp||target.hp===maxHp(target));if(!effect)return {battle:next,damage,events:[],abilityId:null};
 const adjusted=Math.max(0,target.hp-1);return {battle:next,damage:adjusted,abilityId:effect.sourceId,events:[{kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,...(hit===null?{}:{hit})},{kind:'survivalTriggered',targetId:target.actorId,moveId,abilityId:effect.sourceId,hpBefore:target.hp,originalDamage:damage,adjustedDamage:adjusted}]};
}

export function resolveEndTurnAbilityStageBoosts(battle){
 let next=clone(battle),events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){let current=unitById(next,unit.actorId);if(!current||current.hp<=0)continue;for(const effect of abilityEffects(current,'end-turn-stat-boost')){const entryTurn=current.abilityState?.[`entryTurn:${effect.sourceId}`];if(effect.skipEntryTurn&&entryTurn===next.turn)continue;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind});events.push(...stageEvents(current,effect,{boosts:{[effect.stat]:effect.stages},trigger:'end-turn'}));const reset=resolveNegativeStageResetItems(next,{actorIds:[current.actorId],trigger:`ability:${effect.sourceId}:end-turn`});next=reset.battle;events.push(...reset.events);current=unitById(next,unit.actorId);}}
 return {battle:next,events};
}
