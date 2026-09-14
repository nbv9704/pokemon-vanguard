import {dispatchHook} from './registry.mjs';
import {tryBeforeMoveConditions} from './before-action.mjs';
import {recordLastMove} from './move-history.mjs';
import {unitById} from '../rules-v3/battle-state.mjs';
import {modifyMoveByAbility} from './ability-hooks.mjs';
import {applyChoiceItemMoveLock} from './item-hooks.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function createMoveActionHandler({moves,manifests,registry,beforeAction=tryBeforeMoveConditions}){
 return function resolveMove(battle,action,runtime){
  const catalogMove=byId(moves,action.moveId),catalogMechanics=manifests?.[action.moveId];
  if(!catalogMove||!catalogMechanics)throw new Error(`unsupported move: ${action.moveId}`);
  const evidence=catalogMechanics.testEvidence?.[battle.format];if(!Array.isArray(evidence)||!evidence.length)throw new Error(`move lacks ${battle.format} test evidence: ${action.moveId}`);
  const gate=beforeAction?.(battle,action,runtime,catalogMove)||{cancelled:false,battle,events:[]};
  if(gate.cancelled)return {battle:gate.battle,events:gate.events};
  const actor=unitById(gate.battle,action.actorId),modified=modifyMoveByAbility(actor,catalogMove,catalogMechanics),move=modified.move,mechanics=modified.mechanics,choiceLock=applyChoiceItemMoveLock(gate.battle,{actorId:action.actorId,moveId:move.id});
  const started={kind:'moveStarted',actorId:action.actorId,moveId:action.moveId,speed:action.speed,priority:action.priority??0};
  const abilityEvents=modified.applied.filter(effect=>['move-type-by-tag','secondary-effect-power-boost'].includes(effect.kind)).map(effect=>({kind:'abilityTriggered',sourceId:action.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id,...(effect.fromType?{fromType:effect.fromType,toType:effect.toType}:{}),...(effect.suppressedSecondaries?{suppressedSecondaries:effect.suppressedSecondaries}:{} )}));
  const tried=dispatchHook(registry,{hook:'onTryMove',battle:choiceLock.battle,invocations:mechanics.handlers,payload:{action,move,mechanics},runtime});
  if(tried.payload.cancelled){const stopped=tried.payload.recordLastMove?recordLastMove(tried.battle,action.actorId,move.id):tried.battle;return {battle:stopped,events:[...gate.events,started,...abilityEvents,...tried.events]};}
  const onMoveInvocations=[...mechanics.handlers,{id:'prepare-one-shot-damage-item',hook:'onMove',order:95},{id:'prepare-consecutive-move-item',hook:'onMove',order:96},{id:'resolve-flinch-items',hook:'onMove',order:135},{id:'resolve-reactive-switch-items',hook:'onMove',order:140},{id:'resolve-after-move-items',hook:'onMove',order:145}];
  const result=dispatchHook(registry,{hook:'onMove',battle:tried.battle,invocations:onMoveInvocations,payload:tried.payload,runtime});
  return {battle:recordLastMove(result.battle,action.actorId,move.id),events:[...gate.events,started,...abilityEvents,...tried.events,...result.events]};
 };
}
