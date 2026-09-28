import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {HAZARD_IDS} from './manifest-contract.mjs';
import {applyMajorStatus} from './major-status.mjs';
import {unitIsGrounded} from './terrain.mjs';
import {resolveEntryItems,resolveHpThresholdItems,resolveNegativeStageResetItems} from './item-hooks.mjs';
import {resolveEntryAbilities} from './ability-lifecycle.mjs';
import {abilityPreventsIndirectDamage,abilityStatDropBlock,applyAbilityStatDropReflection} from './ability-hooks.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {resolveFaintAbilityCopiesFromEvents} from './ability-replacement.mjs';
import {resolveSlotEffectsOnEntry} from './delayed-effects.mjs';
export {applyHazard} from './hazard-state.mjs';
const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

function hazardDamage(battle,unit,hazard,layers){
 const limit=maxHp(unit);
 if(hazard==='stealth-rock')return {amount:Math.max(1,Math.floor(limit*typeEffectiveness('rock',unit.types)/8)),effectiveness:typeEffectiveness('rock',unit.types)};
 if(hazard==='spikes'){
  if(!unitIsGrounded(unit,battle))return {amount:0,effectiveness:1};
  const fractions={1:[1,8],2:[1,6],3:[1,4]},[numerator,denominator]=fractions[layers]||fractions[3];
  return {amount:Math.max(1,Math.floor(limit*numerator/denominator)),effectiveness:1};
 }
 throw new Error(`unsupported damaging hazard: ${hazard}`);
}

function resolveToxicSpikes(next,unit,state,entry,events){
 if(!unitIsGrounded(unit,next))return next;
 if((unit.types||[]).includes('poison')){
  delete next.sides[entry.side].conditions['toxic-spikes'];
  events.push({kind:'hazardRemoved',actorId:unit.actorId,targetId:unit.actorId,side:entry.side,hazard:'toxic-spikes',layers:state.layers||1,reason:'poison-type-absorption'});
  return next;
 }
 const status=(state.layers||1)>=2?'bad-poison':'poison';
 events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:'toxic-spikes',layers:state.layers||1,status});
 const applied=applyMajorStatus(next,{actorId:state.sourceActorId,targetId:unit.actorId,moveId:state.sourceMoveId||'toxic-spikes',status});
 events.push(...applied.events.map(event=>({...event,hazard:'toxic-spikes',layers:state.layers||1})));
 return applied.battle;
}


function resolveStickyWeb(next,unit,state,entry,events){
 if(!unitIsGrounded(unit,next))return next;
 const rawDelta=-1,changed=abilityStageChange(unit,rawDelta),requestedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
 const source=state.sourceActorId&&unitById(next,state.sourceActorId),sourceSide=source&&sideOf(next,source.actorId),sourceActive=source?.hp>0&&sourceSide&&(next.sides?.[sourceSide]?.active||[]).includes(source.actorId);
 if(sourceActive){const reflected=applyAbilityStatDropReflection(next,{sourceId:source.actorId,targetId:unit.actorId,stat:'spe',requestedDelta,moveId:state.sourceMoveId||'sticky-web',trigger:'hazard:sticky-web'});if(reflected.reflected){events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:'sticky-web',layers:1,reflected:true},...reflected.events);next=reflected.battle;if(reflected.resetActorIds.length){const reset=resolveNegativeStageResetItems(next,{actorIds:reflected.resetActorIds,trigger:'hazard:sticky-web:reflected'});next=reset.battle;events.push(...reset.events);}return next;}}
 const block=abilityStatDropBlock(unit,{battle:next,sourceId:state.sourceActorId||'sticky-web',stat:'spe',requestedDelta});if(block){events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:'sticky-web',layers:1},{kind:'statStageBlocked',actorId:state.sourceActorId||unit.actorId,targetId:unit.actorId,moveId:state.sourceMoveId||'sticky-web',stat:'spe',requestedDelta,...block});return next;}
 unit.stages??={};const before=Number.isInteger(unit.stages.spe)?unit.stages.spe:0,after=Math.max(-6,Math.min(6,before+requestedDelta)),appliedDelta=after-before;unit.stages.spe=after;
 const change={kind:'statStageChanged',actorId:state.sourceActorId||unit.actorId,targetId:unit.actorId,moveId:state.sourceMoveId||'sticky-web',stat:'spe',before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'hazard:sticky-web'};
 events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:'sticky-web',layers:1},change);
 const response=resolveStatDropResponseAbilities(next,{sourceId:state.sourceActorId,targetId:unit.actorId,changes:[change],trigger:'hazard:sticky-web'});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:unit.actorId,changes:[change],trigger:'hazard:sticky-web'});next=copied.battle;events.push(...copied.events);const reset=resolveNegativeStageResetItems(next,{actorIds:[unit.actorId],trigger:'hazard:sticky-web'});next=reset.battle;events.push(...reset.events);return next;
}

export function resolveEntryHazards(battle,switchEvents=[],{manifests=null,moves=null}={}){
 let next=clone(battle);const events=[];const slotEffects=resolveSlotEffectsOnEntry(next,switchEvents);next=slotEffects.battle;events.push(...slotEffects.events);for(const entry of switchEvents||[]){if(entry?.kind!=='switchIn'||!entry.actorId)continue;const entrant=unitById(next,entry.actorId);if(!entrant)continue;entrant.usedMoveIdsSinceEntry=[];entrant.lastUsedMoveIdSinceEntry=null;}const entryAbilities=resolveEntryAbilities(next,switchEvents,{manifests,moves});next=entryAbilities.battle;events.push(...entryAbilities.events);const entryItems=resolveEntryItems(next,switchEvents);next=entryItems.battle;events.push(...entryItems.events);
 for(const entry of switchEvents||[]){
  if(entry?.kind!=='switchIn'||!entry.actorId||!entry.side)continue;
  const entrant=unitById(next,entry.actorId);if(!entrant||entrant.hp<=0)continue;
  const hazards=Object.values(next.sides?.[entry.side]?.conditions||{}).filter(state=>HAZARD_IDS.includes(state?.id)).sort((a,b)=>(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
  for(const state of hazards){
   const unit=unitById(next,entry.actorId);if(!unit||unit.hp<=0)break;
   if(state.id==='toxic-spikes'){next=resolveToxicSpikes(next,unit,state,entry,events);continue;}
   if(state.id==='sticky-web'){next=resolveStickyWeb(next,unit,state,entry,events);continue;}
   const {amount,effectiveness}=hazardDamage(next,unit,state.id,state.layers||1);if(amount<=0)continue;
   const guard=abilityPreventsIndirectDamage(unit);if(guard){events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:state.id,layers:state.layers||1,amount:0,effectiveness,blockedByAbilityId:guard.sourceId},{kind:'abilityTriggered',sourceId:unit.actorId,abilityId:guard.sourceId,effectId:guard.kind,trigger:`hazard:${state.id}`});continue;}
   events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:state.id,layers:state.layers||1,amount,effectiveness});
   const applied=applyHpGroup(next,[{actorId:unit.actorId,delta:-amount}],state.id);next=applied.battle;
   const hazardEvents=applied.events.map(event=>({...event,hazard:state.id,layers:state.layers||1,effectiveness:event.kind==='damage'?effectiveness:event.effectiveness}));events.push(...hazardEvents);
   if(manifests){const copied=resolveFaintAbilityCopiesFromEvents(next,hazardEvents,{manifests});next=copied.battle;events.push(...copied.events);}
   const threshold=resolveHpThresholdItems(next,{actorIds:[unit.actorId],trigger:`hazard:${state.id}`});next=threshold.battle;events.push(...threshold.events);
  }
  const threshold=resolveHpThresholdItems(next,{actorIds:[entry.actorId],trigger:'switch-in'});next=threshold.battle;events.push(...threshold.events);
 }
 return {battle:next,events};
}
