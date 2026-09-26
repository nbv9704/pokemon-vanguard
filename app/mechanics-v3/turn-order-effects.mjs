import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {unitIsGrounded} from './terrain.mjs';
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

export function prepareTurnOrderMoves(battle,actions=[],runtime={},moveManifests={}){
 const next=clone(battle),prepared=(actions||[]).map(action=>({...action})),events=[];
 for(const action of prepared.filter(entry=>entry?.kind==='move')){
  const actor=unitById(next,action.actorId),manifest=moveManifests?.[action.moveId],turnOrder=manifest?.turnOrder;
  if(!actor||actor.hp<=0||!turnOrder)continue;
  const terrain=turnOrder.terrainPriority;
  if(terrain&&next.field?.terrain?.id===terrain.terrain&&(!terrain.requireGrounded||unitIsGrounded(actor,next))){action.priority=(action.priority??0)+(terrain.priorityDelta??0);events.push({kind:'movePriorityChanged',actorId:actor.actorId,moveId:action.moveId,reason:'terrain',terrain:terrain.terrain,priority:action.priority});}
  const volatile=turnOrder.prepareVolatile;
  if(volatile){actor.volatiles??={};actor.volatiles[volatile.id]={id:volatile.id,sourceId:action.moveId,endTurnTimer:volatile.endTurnTimer??1,...(volatile.contactBurn?{contactBurn:true}:{})};events.push({kind:'volatileApplied',actorId:actor.actorId,targetId:actor.actorId,moveId:action.moveId,volatile:volatile.id,reason:'turn-order-preparation'});}
 }
 return {battle:next,actions:prepared,events};
}

export function prepareTurnOrderMechanics(battle,actions=[],runtime={},options={}){
 const moves=prepareTurnOrderMoves(battle,actions,runtime,options.moveManifests),abilities=prepareTurnOrderAbilities(moves.battle,moves.actions,runtime),items=prepareTurnOrderItems(abilities.battle,abilities.actions,runtime);
 return {battle:items.battle,actions:items.actions,events:[...moves.events,...abilities.events,...items.events]};
}
