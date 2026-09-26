import {dispatchHook} from './registry.mjs';
import {tryBeforeMoveConditions} from './before-action.mjs';
import {recordBattleLastMove,recordLastMove} from './move-history.mjs';
import {unitById} from '../rules-v3/battle-state.mjs';
import {effectiveTargetMode} from '../rules-v3/targets.mjs';
import {globalMoveAbilityBlock,modifyMoveByAbility} from './ability-hooks.mjs';
import {applyChoiceItemMoveLock} from './item-hooks.mjs';
import {resolveAfterMoveAbilityState,resolveBeforeMoveAbilityState} from './ability-action-state.mjs';
import {resolveStatusMoveReflection} from './ability-targeting.mjs';
import {resolveFieldTypeAbilities,resolvePreMoveFormAbilities} from './ability-form.mjs';
import {resolveAbilityStartEffects} from './ability-lifecycle.mjs';
import {consumeTransientMoveState} from './transient-move-state.mjs';
import {moveOutcomeFromEvents,recordMoveOutcome,recordTurnEvents} from './turn-history.mjs';
import {consumeNextMoveType} from './next-move-type.mjs';
import {clearDestinyBondBeforeMove} from './destiny-bond.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function createMoveActionHandler({moves,manifests,abilityManifests=null,species=null,registry,beforeAction=tryBeforeMoveConditions}){
 return function resolveMove(battle,action,runtime){
  const catalogMove=byId(moves,action.moveId),catalogMechanics=manifests?.[action.moveId];
  if(!catalogMove||!catalogMechanics)throw new Error(`unsupported move: ${action.moveId}`);
  const finish=(state,events,move=catalogMove,outcome=null)=>{const tracked=recordTurnEvents(state,events,{turn:battle.turn}),result=outcome===null?moveOutcomeFromEvents(move,action.actorId,events):outcome;return {battle:recordMoveOutcome(tracked,action.actorId,move.id,result,{turn:battle.turn}),events};};
  const evidence=catalogMechanics.testEvidence?.[battle.format];if(!Array.isArray(evidence)||!evidence.length)throw new Error(`move lacks ${battle.format} test evidence: ${action.moveId}`);
  const gate=action.skipBeforeAction===true?{cancelled:false,battle,events:[]}:beforeAction?.(battle,action,runtime,catalogMove,catalogMechanics)||{cancelled:false,battle,events:[]};
  if(gate.cancelled)return finish(gate.battle,gate.events,catalogMove,false);
  const bond=clearDestinyBondBeforeMove(gate.battle,{actorId:action.actorId,moveId:action.moveId}),actor=unitById(bond.battle,action.actorId),formTypeHandler=(catalogMechanics.handlers||[]).find(entry=>entry.id==='prepare-form-dependent-move'),formType=formTypeHandler?.params?.typeBySpecies?.[actor?.speciesId],formMove=formType?{...catalogMove,type:formType}:catalogMove,typeState=consumeNextMoveType(bond.battle,{actorId:action.actorId,move:formMove}),typedActor=unitById(typeState.battle,action.actorId),modified=modifyMoveByAbility(typedActor,typeState.move,catalogMechanics,{priority:action.priority,turnOrderAbilityIds:action.turnOrderAbilityIds}),move=modified.move,mechanics={...modified.mechanics,targetMode:effectiveTargetMode(typeState.battle,{actorId:action.actorId,mechanics:modified.mechanics})},choiceLock=action.skipChoiceLock===true?{battle:typeState.battle,events:[]}:applyChoiceItemMoveLock(typeState.battle,{actorId:action.actorId,moveId:move.id});
  const started={kind:'moveStarted',actorId:action.actorId,moveId:action.moveId,speed:action.speed,priority:action.priority??0};
  const formEvents=[...(formType&&formType!==catalogMove.type?[{kind:'moveTypeChanged',actorId:action.actorId,moveId:catalogMove.id,fromType:catalogMove.type,toType:formType,reason:'form'}]:[]),...typeState.events],abilityEvents=modified.applied.filter(effect=>['move-type-by-tag','move-type-conversion','secondary-effect-power-boost','redirection-bypass','opponent-ability-bypass'].includes(effect.kind)).map(effect=>({kind:'abilityTriggered',sourceId:action.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id,...(effect.fromType?{fromType:effect.fromType,toType:effect.toType}:{}),...(effect.suppressedSecondaries?{suppressedSecondaries:effect.suppressedSecondaries}:{} )}));
  const mechanicRuntime={...runtime,moves,moveManifests:manifests,resolveMove,...(abilityManifests?{abilityManifests}:{}),...(species?{species}:{})};
  const tried=dispatchHook(registry,{hook:'onTryMove',battle:choiceLock.battle,invocations:mechanics.handlers,payload:{action,move,mechanics,...(action.skipPp===true?{skipPp:true,skipPpReason:action.skipPpReason||'calledMove'}:{})},runtime:mechanicRuntime});
  if(tried.payload.cancelled){const stopped=tried.payload.recordLastMove?recordLastMove(tried.battle,action.actorId,move.id):tried.battle,events=[...gate.events,started,...bond.events,...formEvents,...abilityEvents,...tried.events];return finish(stopped,events,move,false);}
  const previousBattleLastMove=tried.battle.lastMoveUsed?structuredClone(tried.battle.lastMoveUsed):null,attempted=recordBattleLastMove(tried.battle,{actorId:action.actorId,moveId:move.id,target:tried.payload.action?.target??action.target}),globalBlock=globalMoveAbilityBlock(attempted,move.id);
  if(globalBlock){const stopped=recordLastMove(attempted,action.actorId,move.id,{target:action.target}),events=[...gate.events,started,...bond.events,...formEvents,...abilityEvents,...tried.events,{kind:'abilityTriggered',sourceId:globalBlock.holder.actorId,abilityId:globalBlock.effect.sourceId,effectId:globalBlock.effect.kind,targetId:action.actorId,moveId:move.id},{kind:'moveBlocked',actorId:action.actorId,moveId:move.id,reason:'globalAbility',abilityId:globalBlock.effect.sourceId,sourceId:globalBlock.holder.actorId}];return finish(stopped,events,move,false);}
  const beforeForm=resolvePreMoveFormAbilities(attempted,{actorId:action.actorId,move,calledBy:action.calledBy||null}),beforeState=resolveBeforeMoveAbilityState(beforeForm.battle,{actorId:action.actorId,move}),reflection=resolveStatusMoveReflection(beforeState.battle,{action:tried.payload.action,move,mechanics});
  const onMoveInvocations=[...mechanics.handlers,{id:'prepare-one-shot-damage-item',hook:'onMove',order:95},{id:'prepare-consecutive-move-item',hook:'onMove',order:96},{id:'resolve-outgoing-ability-secondaries',hook:'onMove',order:130},{id:'resolve-item-transfer-abilities',hook:'onMove',order:132},{id:'resolve-flinch-items',hook:'onMove',order:135},{id:'resolve-reactive-switch-items',hook:'onMove',order:140},{id:'resolve-after-move-items',hook:'onMove',order:145}];
  const reflectedPayload={...tried.payload,action:reflection.action,mechanics:reflection.mechanics,previousBattleLastMove},result=dispatchHook(registry,{hook:'onMove',battle:reflection.battle,invocations:onMoveInvocations,payload:reflectedPayload,runtime:mechanicRuntime});
  const transient=consumeTransientMoveState(result.battle,{actorId:action.actorId,move}),transformed=result.events.some(event=>event.kind==='transformed'&&event.actorId===action.actorId),transformedUnit=transformed?unitById(transient.battle,action.actorId):null,abilityChanged=transformedUnit&&transformedUnit.transformState?.original?.activeAbilityId!==transformedUnit.activeAbilityId,abilityStart=abilityChanged?resolveAbilityStartEffects(transient.battle,{actorId:action.actorId,manifests:abilityManifests,moves,trigger:'transform',allowEntryTransform:false,resolveFieldTypes:true}):{battle:transient.battle,events:[]},afterState=resolveAfterMoveAbilityState(abilityStart.battle,{actorId:action.actorId,move}),fieldTypes=resolveFieldTypeAbilities(afterState.battle,{trigger:`move:${move.id}`});
  const events=[...gate.events,started,...bond.events,...formEvents,...abilityEvents,...tried.events,...beforeForm.events,...beforeState.events,...reflection.events,...result.events,...transient.events,...abilityStart.events,...afterState.events,...fieldTypes.events];return finish(recordLastMove(fieldTypes.battle,action.actorId,move.id,{target:action.target}),events,move);
 };
}
