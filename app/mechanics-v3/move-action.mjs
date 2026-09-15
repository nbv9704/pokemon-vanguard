import {dispatchHook} from './registry.mjs';
import {tryBeforeMoveConditions} from './before-action.mjs';
import {recordLastMove} from './move-history.mjs';
import {unitById} from '../rules-v3/battle-state.mjs';
import {globalMoveAbilityBlock,modifyMoveByAbility} from './ability-hooks.mjs';
import {applyChoiceItemMoveLock} from './item-hooks.mjs';
import {resolveAfterMoveAbilityState,resolveBeforeMoveAbilityState} from './ability-action-state.mjs';
import {resolveStatusMoveReflection} from './ability-targeting.mjs';
import {resolveFieldTypeAbilities,resolvePreMoveFormAbilities} from './ability-form.mjs';
import {resolveAbilityStartEffects} from './ability-lifecycle.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function createMoveActionHandler({moves,manifests,abilityManifests=null,registry,beforeAction=tryBeforeMoveConditions}){
 return function resolveMove(battle,action,runtime){
  const catalogMove=byId(moves,action.moveId),catalogMechanics=manifests?.[action.moveId];
  if(!catalogMove||!catalogMechanics)throw new Error(`unsupported move: ${action.moveId}`);
  const evidence=catalogMechanics.testEvidence?.[battle.format];if(!Array.isArray(evidence)||!evidence.length)throw new Error(`move lacks ${battle.format} test evidence: ${action.moveId}`);
  const gate=beforeAction?.(battle,action,runtime,catalogMove)||{cancelled:false,battle,events:[]};
  if(gate.cancelled)return {battle:gate.battle,events:gate.events};
  const actor=unitById(gate.battle,action.actorId),formTypeHandler=(catalogMechanics.handlers||[]).find(entry=>entry.id==='prepare-form-dependent-move'),formType=formTypeHandler?.params?.typeBySpecies?.[actor?.speciesId],baseMove=formType?{...catalogMove,type:formType}:catalogMove,modified=modifyMoveByAbility(actor,baseMove,catalogMechanics,{priority:action.priority,turnOrderAbilityIds:action.turnOrderAbilityIds}),move=modified.move,mechanics=modified.mechanics,choiceLock=applyChoiceItemMoveLock(gate.battle,{actorId:action.actorId,moveId:move.id});
  const started={kind:'moveStarted',actorId:action.actorId,moveId:action.moveId,speed:action.speed,priority:action.priority??0};
  const formEvents=formType&&formType!==catalogMove.type?[{kind:'moveTypeChanged',actorId:action.actorId,moveId:catalogMove.id,fromType:catalogMove.type,toType:formType,reason:'form'}]:[],abilityEvents=modified.applied.filter(effect=>['move-type-by-tag','move-type-conversion','secondary-effect-power-boost','redirection-bypass','opponent-ability-bypass'].includes(effect.kind)).map(effect=>({kind:'abilityTriggered',sourceId:action.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id,...(effect.fromType?{fromType:effect.fromType,toType:effect.toType}:{}),...(effect.suppressedSecondaries?{suppressedSecondaries:effect.suppressedSecondaries}:{} )}));
  const mechanicRuntime=abilityManifests?{...runtime,abilityManifests}:runtime;
  const tried=dispatchHook(registry,{hook:'onTryMove',battle:choiceLock.battle,invocations:mechanics.handlers,payload:{action,move,mechanics},runtime:mechanicRuntime});
  if(tried.payload.cancelled){const stopped=tried.payload.recordLastMove?recordLastMove(tried.battle,action.actorId,move.id):tried.battle;return {battle:stopped,events:[...gate.events,started,...formEvents,...abilityEvents,...tried.events]};}
  const globalBlock=globalMoveAbilityBlock(tried.battle,move.id);
  if(globalBlock){const stopped=recordLastMove(tried.battle,action.actorId,move.id);return {battle:stopped,events:[...gate.events,started,...formEvents,...abilityEvents,...tried.events,{kind:'abilityTriggered',sourceId:globalBlock.holder.actorId,abilityId:globalBlock.effect.sourceId,effectId:globalBlock.effect.kind,targetId:action.actorId,moveId:move.id},{kind:'moveBlocked',actorId:action.actorId,moveId:move.id,reason:'globalAbility',abilityId:globalBlock.effect.sourceId,sourceId:globalBlock.holder.actorId}]};}
  const beforeForm=resolvePreMoveFormAbilities(tried.battle,{actorId:action.actorId,move}),beforeState=resolveBeforeMoveAbilityState(beforeForm.battle,{actorId:action.actorId,move}),reflection=resolveStatusMoveReflection(beforeState.battle,{action,move,mechanics});
  const onMoveInvocations=[...mechanics.handlers,{id:'prepare-one-shot-damage-item',hook:'onMove',order:95},{id:'prepare-consecutive-move-item',hook:'onMove',order:96},{id:'resolve-outgoing-ability-secondaries',hook:'onMove',order:130},{id:'resolve-item-transfer-abilities',hook:'onMove',order:132},{id:'resolve-flinch-items',hook:'onMove',order:135},{id:'resolve-reactive-switch-items',hook:'onMove',order:140},{id:'resolve-after-move-items',hook:'onMove',order:145}];
  const reflectedPayload={...tried.payload,action:reflection.action,mechanics:reflection.mechanics},result=dispatchHook(registry,{hook:'onMove',battle:reflection.battle,invocations:onMoveInvocations,payload:reflectedPayload,runtime:mechanicRuntime});
  const transformed=result.events.some(event=>event.kind==='transformed'&&event.actorId===action.actorId),transformedUnit=transformed?unitById(result.battle,action.actorId):null,abilityChanged=transformedUnit&&transformedUnit.transformState?.original?.activeAbilityId!==transformedUnit.activeAbilityId,abilityStart=abilityChanged?resolveAbilityStartEffects(result.battle,{actorId:action.actorId,manifests:abilityManifests,moves,trigger:'transform',allowEntryTransform:false,resolveFieldTypes:true}):{battle:result.battle,events:[]},afterState=resolveAfterMoveAbilityState(abilityStart.battle,{actorId:action.actorId,move}),fieldTypes=resolveFieldTypeAbilities(afterState.battle,{trigger:`move:${move.id}`});
  return {battle:recordLastMove(fieldTypes.battle,action.actorId,move.id),events:[...gate.events,started,...formEvents,...abilityEvents,...tried.events,...beforeForm.events,...beforeState.events,...reflection.events,...result.events,...abilityStart.events,...afterState.events,...fieldTypes.events]};
 };
}
