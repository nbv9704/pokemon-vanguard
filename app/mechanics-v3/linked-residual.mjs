import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup,resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {prepareMajorStatusEndTurn} from './major-status-residual.mjs';
import {weatherHealingGroup,weatherResidualDamageGroup} from './weather.mjs';
import {terrainHealingGroup} from './terrain.mjs';
import {resolveDelayedEffectsEndTurn} from './delayed-effects.mjs';
import {abilityPreventsIndirectDamage,abilityWeatherResidualDamageGroup,resolveEndTurnAbilityAllyStatusCures,resolveEndTurnAbilityBerryRestores,resolveEndTurnAbilityStatusCures} from './ability-hooks.mjs';
import {resolveEndTurnAbilityStageBoosts} from './ability-damage-response.mjs';
import {resolveFaintAbilityCopiesFromEvents} from './ability-replacement.mjs';
import {resolveEndTurnAbilityForms,resolveFieldTypeAbilities} from './ability-form.mjs';
import {healingWithHeldItems,resolveEndTurnItems,resolveEndTurnItemAbilityLifecycle,resolveHpThresholdItems,resolveNegativeStageResetItems,resolvePpRestoreItems,resolveStatusCureItems,resolveTerrainSeedItems,resolveVolatileCureItems} from './item-hooks.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;

function sourceAtSlot(battle,state){
 const actorId=battle.sides?.[state.sourceSide]?.active?.[state.sourceSlot],unit=actorId&&unitById(battle,actorId);
 return unit?.hp>0?unit:null;
}

export function applyLinkedResiduals(battle){
 let next=clone(battle);const links=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const state=unit.volatiles?.['leech-seed'],source=state&&sourceAtSlot(next,state);
  if(source&&!abilityPreventsIndirectDamage(unit))links.push({targetId:unit.actorId,sourceId:source.actorId,amount:Math.max(1,Math.floor(maxHp(unit)/8))});
 }
 const damage=applyHpGroup(next,links.map(link=>({actorId:link.targetId,delta:-link.amount})),'leech-seed-damage');next=damage.battle;
 const threshold=resolveHpThresholdItems(next,{actorIds:damage.events.filter(event=>event.kind==='damage').map(event=>event.targetId),trigger:'leech-seed'});next=threshold.battle;
 const actualByTarget=new Map(damage.events.filter(event=>event.kind==='damage').map(event=>[event.targetId,event.amount])),healing=new Map();
 for(const link of links){const amount=actualByTarget.get(link.targetId)||0,source=unitById(next,link.sourceId),boosted=source?healingWithHeldItems(amount,source,next,{source:'leech-seed'}):amount;if(amount)healing.set(link.sourceId,(healing.get(link.sourceId)||0)+boosted);}
 const heal=applyHpGroup(next,[...healing].map(([actorId,amount])=>({actorId,delta:amount})),'leech-seed-heal');next=heal.battle;
 return {battle:next,events:[...damage.events,...threshold.events,...heal.events]};
}

export function resolveMechanicsEndTurn(battle,groups=[],{manifests=null}={}){
 let terrain=applyHpGroup(battle,terrainHealingGroup(battle).changes,'terrain-healing'),next=terrain.battle,initialEvents=[{kind:'endTurnStarted',turn:battle.turn},...terrain.events];
 const linked=applyLinkedResiduals(next);next=linked.battle;initialEvents.push(...linked.events);
 if(manifests){const copied=resolveFaintAbilityCopiesFromEvents(next,linked.events,{manifests});next=copied.battle;initialEvents.push(...copied.events);}
 const items=resolveEndTurnItems(next);next=items.battle;initialEvents.push(...items.events);
 const abilityCures=resolveEndTurnAbilityStatusCures(next);next=abilityCures.battle;initialEvents.push(...abilityCures.events);
 const allyCures=resolveEndTurnAbilityAllyStatusCures(next);next=allyCures.battle;initialEvents.push(...allyCures.events);
 const major=prepareMajorStatusEndTurn(next);next=major.battle;initialEvents.push(...major.events);
 return resolveEndTurn(next,[...groups,abilityWeatherResidualDamageGroup(next),weatherResidualDamageGroup(next),weatherHealingGroup(next),major.group],{
  initialEvents,
  afterEachGroup:(state,{groupId,events:groupEvents})=>{
   let current=state,events=[];
   if(manifests){const copied=resolveFaintAbilityCopiesFromEvents(current,groupEvents,{manifests});current=copied.battle;events.push(...copied.events);}
   const threshold=resolveHpThresholdItems(current,{trigger:`end-turn:${groupId}`});return {battle:threshold.battle,events:[...events,...threshold.events]};
  },
  afterGroups:state=>{let current=state,events=[];const delayed=resolveDelayedEffectsEndTurn(current);current=delayed.battle;events.push(...delayed.events);if(manifests){const copied=resolveFaintAbilityCopiesFromEvents(current,delayed.events,{manifests});current=copied.battle;events.push(...copied.events);}const boosts=resolveEndTurnAbilityStageBoosts(current);return {battle:boosts.battle,events:[...events,...boosts.events]};},
  afterTimers:state=>{const cured=resolveStatusCureItems(state,{trigger:'condition-expiry'}),volatile=resolveVolatileCureItems(cured.battle,{trigger:'condition-expiry'}),reset=resolveNegativeStageResetItems(volatile.battle,{trigger:'condition-expiry'}),pp=resolvePpRestoreItems(reset.battle,{trigger:'condition-expiry'}),seeds=resolveTerrainSeedItems(pp.battle,{trigger:'condition-expiry'}),itemAbilities=resolveEndTurnItemAbilityLifecycle(seeds.battle),harvest=resolveEndTurnAbilityBerryRestores(itemAbilities.battle),forms=resolveEndTurnAbilityForms(harvest.battle),fieldTypes=resolveFieldTypeAbilities(forms.battle,{trigger:'end-turn'});return {battle:fieldTypes.battle,events:[...cured.events,...volatile.events,...reset.events,...pp.events,...seeds.events,...itemAbilities.events,...harvest.events,...forms.events,...fieldTypes.events]};}
 });
}
