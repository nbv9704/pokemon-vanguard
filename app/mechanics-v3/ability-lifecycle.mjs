import {activeUnits,clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {resolveFieldTypeAbilities} from './ability-form.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {abilityStatDropBlock,applyAbilityStatDropReflection} from './ability-hooks.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {heldItemId,revealHeldItem,resolveNegativeStageResetItems} from './item-hooks.mjs';
import {effectiveBattleSpeed} from './speed.mjs';
import {applyWeather} from './weather.mjs';
import {resolveEntryAbilityCopies} from './ability-replacement.mjs';
import {resolveEntryIllusionAbility,resolveEntryTransformAbility} from './ability-transform.mjs';

const STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
const SCREEN_CONDITIONS=['reflect','light-screen','aurora-veil'];
const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');

function orderedEntries(battle,switchEvents){
 return (switchEvents||[]).filter(entry=>entry?.kind==='switchIn'&&entry.actorId&&entry.side).map((entry,index)=>({entry,index,unit:unitById(battle,entry.actorId)})).filter(record=>record.unit?.hp>0).sort((left,right)=>effectiveBattleSpeed(battle,right.unit)-effectiveBattleSpeed(battle,left.unit)||left.index-right.index||String(left.entry.actorId).localeCompare(String(right.entry.actorId)));
}

function applyEntryWeather(battle,unit,effect,trigger='entry'){
 const applied=applyWeather(battle,{actorId:unit.actorId,moveId:`ability:${effect.sourceId}`,weather:effect.weather,defaultTurns:effect.turns||5});
 return {battle:applied.battle,events:[{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind},...applied.events.map(event=>({...event,sourceAbilityId:effect.sourceId,trigger}))]};
}

function applyEntryStatDrop(battle,unit,effect,trigger='entry'){
 let next=clone(battle);const events=[],sourceSide=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!sourceSide)return {battle:next,events};
 if(effect.oncePerBattle){unit=unitById(next,unit.actorId);unit.abilityState??={};const key=`entry:${effect.sourceId}:${effect.kind}`;if(unit.abilityState[key])return {battle:next,events};unit.abilityState[key]=true;}
 const targetSide=otherSide(sourceSide),targets=activeUnits(next,targetSide).map(entry=>entry.unit);
 for(const target of targets){
  const current=unitById(next,target.actorId);if(!current||current.hp<=0)continue;current.stages??={};const stat=effect.stat,changed=abilityStageChange(current,effect.stages),requestedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
  const reflection=applyAbilityStatDropReflection(next,{sourceId:unit.actorId,targetId:current.actorId,sourceAbilityId:effect.sourceId,stat,requestedDelta,trigger});if(reflection.reflected){next=reflection.battle;events.push(...reflection.events);if(reflection.resetActorIds.length){const reflectedReset=resolveNegativeStageResetItems(next,{actorIds:reflection.resetActorIds,trigger:`ability:${effect.sourceId}:${trigger}-stat-reflect`});next=reflectedReset.battle;events.push(...reflectedReset.events);}continue;}
  const block=abilityStatDropBlock(current,{battle:next,sourceId:unit.actorId,sourceAbilityId:effect.sourceId,stat,requestedDelta});
  if(block){events.push({kind:'statStageBlocked',actorId:unit.actorId,targetId:current.actorId,abilityId:effect.sourceId,stat,requestedDelta,trigger,...block});continue;}
  const before=Number.isInteger(current.stages[stat])?current.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;current.stages[stat]=after;
  const change={kind:'statStageChanged',actorId:unit.actorId,targetId:current.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger};events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:current.actorId},change);
  const response=resolveStatDropResponseAbilities(next,{sourceId:unit.actorId,targetId:current.actorId,changes:[change],trigger});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:current.actorId,changes:[change],trigger});next=copied.battle;events.push(...copied.events);
 }
 const reset=resolveNegativeStageResetItems(next,{actorIds:targets.map(target=>target.actorId),trigger:`ability:${effect.sourceId}:${trigger}-stat-drop`});next=reset.battle;events.push(...reset.events);
 return {battle:next,events};
}

function applyEntryScreenCleaner(battle,unit,effect,trigger='entry'){
 const next=clone(battle),events=[];let removed=0;
 for(const side of ['A','B'])for(const condition of SCREEN_CONDITIONS)if(next.sides?.[side]?.conditions?.[condition]){delete next.sides[side].conditions[condition];removed++;events.push({kind:'sideConditionEnded',side,condition,reason:'ability',abilityId:effect.sourceId,sourceId:unit.actorId,trigger});}
 if(removed)events.unshift({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind});
 return {battle:next,events};
}

function applyEntryAllyStageReset(battle,unit,effect,trigger='entry'){
 const next=clone(battle),events=[];const side=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!side)return {battle:next,events};let changed=false;
 for(const {unit:ally} of activeUnits(next,side)){
  if(ally.actorId===unit.actorId)continue;ally.stages??={};
  for(const stat of STAGES){const before=Number.isInteger(ally.stages[stat])?ally.stages[stat]:0;if(before===0)continue;ally.stages[stat]=0;changed=true;events.push({kind:'statStageChanged',actorId:unit.actorId,targetId:ally.actorId,abilityId:effect.sourceId,stat,before,after:0,requestedDelta:-before,appliedDelta:-before,reason:'ability',trigger});}
 }
 if(changed)events.unshift({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind});
 return {battle:next,events};
}

function applyEntryItemReveal(battle,unit,effect,trigger='entry'){
 let next=clone(battle);const events=[],side=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!side)return {battle:next,events};
 for(const {unit:foe} of activeUnits(next,otherSide(side))){const itemId=heldItemId(foe);if(!itemId)continue;const revealed=revealHeldItem(next,{actorId:foe.actorId,itemId,reason:`ability:${effect.sourceId}`,force:true});next=revealed.battle;if(revealed.revealed)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:foe.actorId,itemId},...revealed.events.map(event=>({...event,abilityId:effect.sourceId,sourceActorId:unit.actorId,trigger})));}
 return {battle:next,events};
}

function moveById(moves,id){return Array.isArray(moves)?moves.find(move=>move?.id===id):moves?.[id]||null;}

function applyEntryDangerSense(battle,unit,effect,moves,trigger='entry'){
 const next=clone(battle),side=['A','B'].find(candidate=>next.sides?.[candidate]?.active?.includes(unit.actorId));if(!side||!moves)return {battle:next,events:[]};
 for(const {unit:foe} of activeUnits(next,otherSide(side))){
  for(const moveId of foe?.buildSnapshot?.moveIds||[]){const move=moveById(moves,moveId);if(!move||move.category==='status')continue;const effectiveness=typeEffectiveness(move.type,unit.types||[]);if(move.ohko!==true&&effectiveness<=1)continue;return {battle:next,events:[{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:foe.actorId,dangerousMoveId:move.id,trigger,...(move.ohko===true?{ohko:true}:{effectiveness})}]};}
 }
 return {battle:next,events:[]};
}

function applyEntryFaintedAllyPowerBoost(battle,unit,effect,trigger='entry'){
 const next=clone(battle),current=unitById(next,unit.actorId),side=['A','B'].find(side=>next.sides?.[side]?.roster?.some(candidate=>candidate.actorId===unit.actorId));if(!current||!side)return {battle:next,events:[]};
 const count=Math.min(effect.maxCount,(next.sides[side].roster||[]).filter(candidate=>candidate.actorId!==current.actorId&&candidate.hp<=0).length);current.abilityState??={};current.abilityState[`fainted-allies:${effect.sourceId}`]={count,entryTurn:next.turn};
 return {battle:next,events:count?[{kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind,faintedAllies:count,multiplier:1+effect.increment*count,trigger}]:[]};
}

function applyEntryAllyHeal(battle,unit,effect,trigger='entry'){
 let next=clone(battle);const side=['A','B'].find(side=>next.sides?.[side]?.active?.includes(unit.actorId));if(!side)return {battle:next,events:[]};
 const ally=activeUnits(next,side).map(entry=>entry.unit).find(candidate=>candidate.actorId!==unit.actorId&&candidate.hp>0&&candidate.hp<maxHp(candidate));if(!ally)return {battle:next,events:[]};
 const amount=Math.max(1,Math.floor(maxHp(ally)*(effect.numerator??1)/(effect.denominator??4))),healed=applyHpGroup(next,[{actorId:ally.actorId,delta:amount}],`ability:${effect.sourceId}`);next=healed.battle;
 return {battle:next,events:healed.events.length?[{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:ally.actorId},...healed.events.map(event=>({...event,abilityId:effect.sourceId,trigger}))]:[]};
}

export function resolveAbilityStartEffects(battle,{actorId,slot=null,manifests=null,moves=null,trigger='entry',allowEntryTransform=true,resolveFieldTypes=true}={}){
 let next=clone(battle),events=[];let unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,events};
 const side=['A','B'].find(candidate=>next.sides?.[candidate]?.active?.includes(actorId)),resolvedSlot=Number.isInteger(slot)?slot:(side?next.sides[side].active.indexOf(actorId):0);
 if(allowEntryTransform&&!unit.transformState){const transformed=resolveEntryTransformAbility(next,{actorId:unit.actorId,slot:resolvedSlot});next=transformed.battle;events.push(...transformed.events);unit=unitById(next,actorId);}
 if(manifests){const copied=resolveEntryAbilityCopies(next,{actorId:unit.actorId,manifests});next=copied.battle;events.push(...copied.events);unit=unitById(next,actorId);}
 for(const effect of abilityEffects(unit))if(effect.kind==='end-turn-stat-boost'){unit.abilityState??={};unit.abilityState[`entryTurn:${effect.sourceId}`]=next.turn;}
 for(const effect of abilityEffects(unit)){
  let result=null;
  if(effect.kind==='entry-weather')result=applyEntryWeather(next,unit,effect,trigger);
  else if(effect.kind==='entry-stat-drop')result=applyEntryStatDrop(next,unit,effect,trigger);
  else if(effect.kind==='entry-screen-cleaner')result=applyEntryScreenCleaner(next,unit,effect,trigger);
  else if(effect.kind==='entry-ally-stage-reset')result=applyEntryAllyStageReset(next,unit,effect,trigger);
  else if(effect.kind==='entry-ally-heal')result=applyEntryAllyHeal(next,unit,effect,trigger);
  else if(effect.kind==='entry-item-reveal')result=applyEntryItemReveal(next,unit,effect,trigger);
  else if(effect.kind==='entry-fainted-ally-power-boost')result=applyEntryFaintedAllyPowerBoost(next,unit,effect,trigger);
  else if(effect.kind==='entry-danger-sense')result=applyEntryDangerSense(next,unit,effect,moves,trigger);
  if(result){next=result.battle;events.push(...result.events);unit=unitById(next,actorId)||unit;}
 }
 if(resolveFieldTypes){const fieldTypes=resolveFieldTypeAbilities(next,{trigger});next=fieldTypes.battle;events.push(...fieldTypes.events);}
 return {battle:next,events};
}

export function resolveEntryAbilities(battle,switchEvents=[],{manifests=null,moves=null}={}){
 let next=clone(battle);const events=[];
 for(const record of orderedEntries(next,switchEvents)){
  let unit=unitById(next,record.entry.actorId);if(!unit||unit.hp<=0)continue;
  const illusion=resolveEntryIllusionAbility(next,{actorId:unit.actorId});next=illusion.battle;events.push(...illusion.events);
  const started=resolveAbilityStartEffects(next,{actorId:record.entry.actorId,slot:record.entry.slot,manifests,moves,trigger:'entry',allowEntryTransform:true,resolveFieldTypes:false});next=started.battle;events.push(...started.events);
 }
 const fieldTypes=resolveFieldTypeAbilities(next,{trigger:'entry'});next=fieldTypes.battle;events.push(...fieldTypes.events);
 return {battle:next,events};
}
