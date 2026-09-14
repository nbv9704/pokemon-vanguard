import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup,resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {prepareMajorStatusEndTurn} from './major-status-residual.mjs';
import {weatherHealingGroup} from './weather.mjs';
import {terrainHealingGroup} from './terrain.mjs';
import {resolveDelayedEffectsEndTurn} from './delayed-effects.mjs';
import {abilityWeatherResidualDamageGroup} from './ability-hooks.mjs';
import {resolveEndTurnItems,resolveHpThresholdItems,resolveStatusCureItems} from './item-hooks.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;

function sourceAtSlot(battle,state){
 const actorId=battle.sides?.[state.sourceSide]?.active?.[state.sourceSlot],unit=actorId&&unitById(battle,actorId);
 return unit?.hp>0?unit:null;
}

export function applyLinkedResiduals(battle){
 let next=clone(battle);const links=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const state=unit.volatiles?.['leech-seed'],source=state&&sourceAtSlot(next,state);
  if(source)links.push({targetId:unit.actorId,sourceId:source.actorId,amount:Math.max(1,Math.floor(maxHp(unit)/8))});
 }
 const damage=applyHpGroup(next,links.map(link=>({actorId:link.targetId,delta:-link.amount})),'leech-seed-damage');next=damage.battle;
 const threshold=resolveHpThresholdItems(next,{actorIds:damage.events.filter(event=>event.kind==='damage').map(event=>event.targetId),trigger:'leech-seed'});next=threshold.battle;
 const actualByTarget=new Map(damage.events.filter(event=>event.kind==='damage').map(event=>[event.targetId,event.amount])),healing=new Map();
 for(const link of links){const amount=actualByTarget.get(link.targetId)||0;if(amount)healing.set(link.sourceId,(healing.get(link.sourceId)||0)+amount);}
 const heal=applyHpGroup(next,[...healing].map(([actorId,amount])=>({actorId,delta:amount})),'leech-seed-heal');next=heal.battle;
 return {battle:next,events:[...damage.events,...threshold.events,...heal.events]};
}

export function resolveMechanicsEndTurn(battle,groups=[]){
 const terrain=applyHpGroup(battle,terrainHealingGroup(battle).changes,'terrain-healing'),linked=applyLinkedResiduals(terrain.battle),items=resolveEndTurnItems(linked.battle),major=prepareMajorStatusEndTurn(items.battle);
 return resolveEndTurn(major.battle,[...groups,abilityWeatherResidualDamageGroup(major.battle),weatherHealingGroup(major.battle),major.group],{initialEvents:[{kind:'endTurnStarted',turn:battle.turn},...terrain.events,...linked.events,...items.events],afterEachGroup:(state,{groupId})=>resolveHpThresholdItems(state,{trigger:`end-turn:${groupId}`}),afterGroups:resolveDelayedEffectsEndTurn,afterTimers:state=>resolveStatusCureItems(state,{trigger:'condition-expiry'})});
}
