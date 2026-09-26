import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {effectiveWeatherForUnit} from '../ability-field.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

function healingFraction(battle,params,actor){
 if(params.stockpileScaled){const layers=actor?.volatiles?.stockpile?.layers||0;return layers>=3?[1,1]:layers===2?[1,2]:[1,4];}
 if(!params.weatherScaled)return [params.numerator,params.denominator];
 const weather=effectiveWeatherForUnit(battle,actor);
 if(weather==='sun')return [2,3];
 if(weather)return [1,4];
 return [params.numerator,params.denominator];
}

function tagHealingMultiplier(actor,mechanics,tag){
 if(!tag)return {multiplier:1,applied:[]};
 const tags=new Set(mechanics?.tags||[]),applied=(actor?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind==='move-tag-power-boost'&&effect.tag===tag&&tags.has(tag));
 return {multiplier:applied.reduce((value,effect)=>value*(effect.multiplier??1),1),applied};
}

export const applyHealHandler={
 id:'apply-heal',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move,mechanics}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,healedTargetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const hitTargets=(payload.hitTargetIds||[]).map(id=>unitById(next,id)).filter(Boolean),targets=params.target==='active-allies'?activeUnits(next,action.side).map(entry=>entry.unit):params.target==='hit-targets'?hitTargets:params.target==='hit-allies'?hitTargets.filter(target=>next.sides?.[action.side]?.roster?.some(unit=>unit.actorId===target.actorId)):[actor],fraction=healingFraction(next,params,actor),tagBoost=tagHealingMultiplier(actor,mechanics,params.abilityBoostTag),changes=[];
  for(const target of targets){const limit=maxHp(target);if(!Number.isInteger(limit)||limit<1)throw new Error(`invalid max HP for ${target.actorId}`);if(target.hp>=limit)continue;const raw=limit*fraction[0]/fraction[1]*tagBoost.multiplier,amount=params.rounding==='ceil'?Math.ceil(raw):Math.floor(raw);changes.push({actorId:target.actorId,delta:Math.max(1,amount)});}
  if(!changes.length)return {battle:next,payload:{...payload,healedTargetIds:[]},events:params.failIfNoHealing===false?[]:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noHealing'}]};
  const applied=applyHpGroup(next,changes,`move:${move.id}`);next=applied.battle;const healedTargetIds=applied.events.filter(event=>event.kind==='heal').map(event=>event.targetId),abilityEvents=tagBoost.applied.map(effect=>({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id,tag:effect.tag,multiplier:effect.multiplier})),events=[...abilityEvents,...applied.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id}))];
  if(!healedTargetIds.length&&params.failIfNoHealing!==false)events.push({kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noHealing'});
  return {battle:next,payload:{...payload,healedTargetIds,healFraction:{numerator:fraction[0],denominator:fraction[1]},healMultiplier:tagBoost.multiplier},events};
 }
};
