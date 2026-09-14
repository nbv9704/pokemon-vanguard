import {activeUnits,clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {abilityStatDropBlock} from './ability-hooks.mjs';
import {resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';
import {effectiveBattleSpeed} from './speed.mjs';
import {applyWeather} from './weather.mjs';

const STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
const SCREEN_CONDITIONS=['reflect','light-screen','aurora-veil'];
const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');

function orderedEntries(battle,switchEvents){
 return (switchEvents||[]).filter(entry=>entry?.kind==='switchIn'&&entry.actorId&&entry.side).map((entry,index)=>({entry,index,unit:unitById(battle,entry.actorId)})).filter(record=>record.unit?.hp>0).sort((left,right)=>effectiveBattleSpeed(battle,right.unit)-effectiveBattleSpeed(battle,left.unit)||left.index-right.index||String(left.entry.actorId).localeCompare(String(right.entry.actorId)));
}

function applyEntryWeather(battle,unit,effect){
 const applied=applyWeather(battle,{actorId:unit.actorId,moveId:`ability:${effect.sourceId}`,weather:effect.weather,defaultTurns:effect.turns||5});
 return {battle:applied.battle,events:[{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind},...applied.events.map(event=>({...event,sourceAbilityId:effect.sourceId,trigger:'entry'}))]};
}

function applyEntryStatDrop(battle,unit,effect){
 let next=clone(battle);const events=[],sourceSide=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!sourceSide)return {battle:next,events};
 if(effect.oncePerBattle){unit=unitById(next,unit.actorId);unit.abilityState??={};const key=`entry:${effect.sourceId}:${effect.kind}`;if(unit.abilityState[key])return {battle:next,events};unit.abilityState[key]=true;}
 const targetSide=otherSide(sourceSide),targets=activeUnits(next,targetSide).map(entry=>entry.unit);
 for(const target of targets){
  const current=unitById(next,target.actorId);if(!current||current.hp<=0)continue;current.stages??={};const stat=effect.stat,requestedDelta=effect.stages;
  const block=abilityStatDropBlock(current,{battle:next,sourceId:unit.actorId,sourceAbilityId:effect.sourceId,stat,requestedDelta});
  if(block){events.push({kind:'statStageBlocked',actorId:unit.actorId,targetId:current.actorId,abilityId:effect.sourceId,stat,requestedDelta,trigger:'entry',...block});continue;}
  const before=Number.isInteger(current.stages[stat])?current.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;current.stages[stat]=after;
  const change={kind:'statStageChanged',actorId:unit.actorId,targetId:current.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'entry'};events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:current.actorId},change);
  const response=resolveStatDropResponseAbilities(next,{sourceId:unit.actorId,targetId:current.actorId,changes:[change],trigger:'entry'});next=response.battle;events.push(...response.events);
 }
 const reset=resolveNegativeStageResetItems(next,{actorIds:targets.map(target=>target.actorId),trigger:`ability:${effect.sourceId}:entry-stat-drop`});next=reset.battle;events.push(...reset.events);
 return {battle:next,events};
}

function applyEntryScreenCleaner(battle,unit,effect){
 const next=clone(battle),events=[];let removed=0;
 for(const side of ['A','B'])for(const condition of SCREEN_CONDITIONS)if(next.sides?.[side]?.conditions?.[condition]){delete next.sides[side].conditions[condition];removed++;events.push({kind:'sideConditionEnded',side,condition,reason:'ability',abilityId:effect.sourceId,sourceId:unit.actorId,trigger:'entry'});}
 if(removed)events.unshift({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind});
 return {battle:next,events};
}

function applyEntryAllyStageReset(battle,unit,effect){
 const next=clone(battle),events=[];const side=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!side)return {battle:next,events};let changed=false;
 for(const {unit:ally} of activeUnits(next,side)){
  if(ally.actorId===unit.actorId)continue;ally.stages??={};
  for(const stat of STAGES){const before=Number.isInteger(ally.stages[stat])?ally.stages[stat]:0;if(before===0)continue;ally.stages[stat]=0;changed=true;events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:ally.actorId,abilityId:effect.sourceId,stat,before,after:0,requestedDelta:-before,appliedDelta:-before,reason:'ability',trigger:'entry'});}
 }
 if(changed)events.unshift({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind});
 return {battle:next,events};
}

function applyEntryAllyHeal(battle,unit,effect){
 let next=clone(battle);const side=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!side)return {battle:next,events:[]};
 const ally=activeUnits(next,side).map(entry=>entry.unit).find(candidate=>candidate.actorId!==unit.actorId&&candidate.hp>0&&candidate.hp<maxHp(candidate));if(!ally)return {battle:next,events:[]};
 const amount=Math.max(1,Math.floor(maxHp(ally)*(effect.numerator??1)/(effect.denominator??4))),healed=applyHpGroup(next,[{actorId:ally.actorId,delta:amount}],`ability:${effect.sourceId}`);next=healed.battle;
 return {battle:next,events:healed.events.length?[{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:ally.actorId},...healed.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'entry'}))]:[]};
}

export function resolveEntryAbilities(battle,switchEvents=[]){
 let next=clone(battle);const events=[];
 for(const record of orderedEntries(next,switchEvents)){
  const unit=unitById(next,record.entry.actorId);if(!unit||unit.hp<=0)continue;
  for(const effect of abilityEffects(unit))if(effect.kind==='end-turn-stat-boost'){unit.abilityState??={};unit.abilityState[`entryTurn:${effect.sourceId}`]=next.turn;}
  for(const effect of abilityEffects(unit)){
   let result=null;
   if(effect.kind==='entry-weather')result=applyEntryWeather(next,unit,effect);
   else if(effect.kind==='entry-stat-drop')result=applyEntryStatDrop(next,unit,effect);
   else if(effect.kind==='entry-screen-cleaner')result=applyEntryScreenCleaner(next,unit,effect);
   else if(effect.kind==='entry-ally-stage-reset')result=applyEntryAllyStageReset(next,unit,effect);
   else if(effect.kind==='entry-ally-heal')result=applyEntryAllyHeal(next,unit,effect);
   if(result){next=result.battle;events.push(...result.events);}
  }
 }
 return {battle:next,events};
}
