import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {turnOrderAbilityEffects} from './ability-hooks.mjs';
import {prepareTurnOrderItems} from './item-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

function effectApplies(effect,actor,action){
 if(effect.requireFullHp&&actor.hp!==maxHp(actor))return false;
 if((effect.types||[]).length&&!effect.types.includes(action.moveType))return false;
 if((effect.categories||[]).length&&!effect.categories.includes(action.moveCategory))return false;
 return true;
}

export function prepareTurnOrderAbilities(battle,actions=[],runtime={}){
 const next=clone(battle),prepared=(actions||[]).map(action=>({...action})),events=[];
 const ordered=[...prepared].filter(action=>action?.kind==='move').sort((left,right)=>String(left.actorId).localeCompare(String(right.actorId)));
 for(const action of ordered){
  const actor=unitById(next,action.actorId);if(!actor||actor.hp<=0)continue;
  for(const effect of turnOrderAbilityEffects(actor)){
   if(!effectApplies(effect,actor,action))continue;
   if(Number.isFinite(effect.chance)){
    if(typeof runtime.nextRandom!=='function')throw new Error('probabilistic turn-order ability requires seeded nextRandom');
    if(runtime.nextRandom()>=effect.chance)continue;
   }
   const actual=prepared.find(entry=>entry.actorId===action.actorId);if(!actual)continue;
   if(Number.isInteger(effect.priorityDelta))actual.priority=(actual.priority??0)+effect.priorityDelta;
   if(Number.isInteger(effect.orderBoost))actual.orderBoost=(actual.orderBoost??0)+effect.orderBoost;
   actual.turnOrderAbilityIds=[...new Set([...(actual.turnOrderAbilityIds||[]),effect.sourceId])];
   events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:effect.sourceId,effectId:effect.kind,reason:'turn-order',priority:actual.priority??0,orderBoost:actual.orderBoost??0});
  }
 }
 return {battle:next,actions:prepared,events};
}

export function prepareTurnOrderMechanics(battle,actions=[],runtime={}){
 const abilities=prepareTurnOrderAbilities(battle,actions,runtime),items=prepareTurnOrderItems(abilities.battle,abilities.actions,runtime);
 return {battle:items.battle,actions:items.actions,events:[...abilities.events,...items.events]};
}
