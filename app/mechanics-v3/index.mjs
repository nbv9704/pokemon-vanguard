export {CONTENT_KINDS,BATTLE_FORMATS,BATTLE_STAGES,MAJOR_STATUS_IDS,VOLATILE_STATUS_IDS,VARIABLE_POWER_FORMULAS,WEATHER_IDS,TERRAIN_IDS,SIDE_CONDITION_IDS,HAZARD_IDS,ROOM_IDS,DELAYED_EFFECT_IDS,TWO_TURN_MOVE_KINDS,SEMI_INVULNERABLE_MODES,MOVE_TAG_IDS,SECONDARY_EFFECT_KINDS,HOOKS,validateMechanicManifest} from './manifest-contract.mjs';
export {createHookRegistry,dispatchHook} from './registry.mjs';
export {validateManifestCatalog,coverageForEntry,buildMechanicsCoverage} from './coverage.mjs';
export {directDamageHandler} from './handlers/direct-damage.mjs';
export {applySecondaryEffectsHandler} from './handlers/apply-secondary-effects.mjs';
export {applySecondaryEffects} from './secondary-effects.mjs';
export {applyDamageHit} from './damage-hit.mjs';
export {multiHitDamageHandler,selectHitCount} from './handlers/multi-hit-damage.mjs';
export {applyRecoilHandler} from './handlers/apply-recoil.mjs';
export {applyDrainHandler} from './handlers/apply-drain.mjs';
export {fixedDamageHandler} from './handlers/fixed-damage.mjs';
export {variablePowerDamageHandler} from './handlers/variable-power-damage.mjs';
export {variableMovePower} from './variable-power.mjs';
export {applyProtectionHandler} from './handlers/apply-protection.mjs';
export {applySideProtectionHandler} from './handlers/apply-side-protection.mjs';
export {breakProtectionHandler} from './handlers/break-protection.mjs';
export {applyRedirectionHandler} from './handlers/apply-redirection.mjs';
export {applyRedirection} from './redirection-state.mjs';
export {applyPivotSwitchHandler} from './handlers/apply-pivot-switch.mjs';
export {applyForcedSwitchHandler} from './handlers/apply-forced-switch.mjs';
export {applyPivotSwitch,applyForcedSwitches,applyPositionSwap,validateSwitchingChoice} from './switching.mjs';
export {applyMechanicsSwitch,applyMechanicsReplacementSwitch,resolveSwitchOutAbilities} from './switch-lifecycle.mjs';
export {resolveAbilityStartEffects,resolveEntryAbilities} from './ability-lifecycle.mjs';
export {resolveContactAbilityResponses} from './ability-contact.mjs';
export {resolveDamageResponseAbilities,resolveKoAbilityEffects,applyLethalHitSurvivalAbility,resolveEndTurnAbilityStageBoosts} from './ability-damage-response.mjs';
export {applyPositionSwapHandler} from './handlers/apply-position-swap.mjs';
export {heldDamageBoostHandler,lowHpTypeBoostHandler,receivedTypeDamageReductionHandler} from './handlers/passive-damage-modifiers.mjs';
export {megaStoneHandler} from './handlers/mega-stone.mjs';
export {compilePassiveEffects,passiveDamageModifiers,receivedDamageModifiers,passiveEffectActive} from './passive-effects.mjs';
export {createHeldItemState,heldItemId,heldItemEffectActive,activateHeldItem,revealHeldItem,consumeHeldBerry,recycleConsumedItem,hasConsumedBerry,heldItemHasEffect,typeEffectivenessWithHeldItems,applyResistanceBerryToMoveDamage,applySurvivalItemToMoveDamage,resolvePostDamageItems,resolveContactDamageItems,resolveAfterMoveItems,resolveHpThresholdItems,resolveEndTurnItems,resolveEndTurnItemAbilityLifecycle,transferHeldItem,removeHeldItem,resolveStatusCureItems,resolveVolatileCureItems,resolveNegativeStageResetItems,resolveTerrainSeedItems,resolvePpRestoreItems,resolveEntryItems,prepareOneShotMoveDamageItem,prepareConsecutiveMoveItem,prepareTurnOrderItems,resolveFlinchItems,resolveReactiveSwitchItems,speedWithHeldItems,statWithHeldItems,accuracyWithHeldItems,healingWithHeldItems,criticalChanceWithHeldItems,validateChoiceItemMove,applyChoiceItemMoveLock} from './item-hooks.mjs';
export {validateBetaSlice} from './beta-slice.mjs';
export {applyProtect,applyEndure,applySideGuard,breakProtection,isProtectedTarget,protectionBlockReason,resolveProtectionBlock} from './protection.mjs';
export {spendPpHandler} from './handlers/spend-pp.mjs';
export {applyStatStagesHandler} from './handlers/apply-stat-stages.mjs';
export {checkAccuracyHandler,effectiveAccuracy} from './handlers/check-accuracy.mjs';
export {applyMajorStatusHandler} from './handlers/apply-major-status.mjs';
export {applyVolatileStatusHandler} from './handlers/apply-volatile-status.mjs';
export {MAJOR_STATUSES,applyMajorStatus,majorStatusBlockReason,majorStatusEndTurnGroup,majorStatusTurnOptions,prepareMajorStatusEndTurn,resolveMajorStatusEndTurn,speedWithMajorStatus,tryMajorStatusAction} from './major-status.mjs';
export {HANDLER_DEFINITIONS} from './handlers/index.mjs';
export {prepareRetaliationHandler,requireUserUnhitHandler} from './handlers/prepare-retaliation.mjs';
export {applyWeather,weatherDamageModifier,weatherHealingGroup,weatherResidualDamageGroup,defenseWithWeather,speedWithWeather} from './weather.mjs';
export {applyTerrain,terrainDamageModifiers,terrainHealingGroup,terrainMajorStatusBlockReason,terrainPriorityBlockReason,terrainVolatileBlockReason,unitIsGrounded} from './terrain.mjs';
export {applySideCondition,sideConditionDamageModifiers,speedWithSideConditions} from './side-conditions.mjs';
export {applyHazard,resolveEntryHazards} from './hazards.mjs';
export {applyRoom,roomActive,roomState,wonderRoomDefenseBase} from './rooms.mjs';
export {applyRoomHandler} from './handlers/apply-room.mjs';
export {DELAYED_EFFECT_IDS as DELAYED_EFFECTS,scheduleDelayedEffect,scheduleDelayedEffectForActive,resolveDelayedEffectsEndTurn,resolveFutureAttacksEndTurn,resolveSlotEffectsOnEntry} from './delayed-effects.mjs';
export {scheduleDelayedEffectHandler} from './handlers/schedule-delayed-effect.mjs';
export {createMoveActionHandler} from './move-action.mjs';
export {TEST_EVIDENCE} from './test-evidence.mjs';
export {buildMoveCapabilityInventory,reviewSignalsForMove} from './capability-inventory.mjs';
export {applyVolatileStatus} from './volatile-state.mjs';
export {tryConfusionAction,tryFlinchAction,tryVolatileAction} from './volatile-action.mjs';
export {tryBeforeMoveConditions} from './before-action.mjs';
export {createMoveChoiceValidator,tryVolatileMoveRestriction,validateVolatileMoveChoice,validateVolatileSwitchChoice} from './move-restrictions.mjs';
export {recordLastMove,recordBattleLastMove} from './move-history.mjs';
export {allyFaintedPreviousTurn,lastDamageReceivedThisTurn,moveOutcomeFromEvents,previousMoveFailed,recordMoveOutcome,recordTurnEvents,statsLoweredThisTurn,statsRaisedThisTurn,targetDamagedThisTurn,targetDamagedUserThisTurn} from './turn-history.mjs';
export {applyLinkedResiduals,resolveMechanicsEndTurn} from './linked-residual.mjs';
export {prepareBindingResidualEndTurn} from './binding-residual.mjs';

export {resolveDefogCleanup,resolveRapidSpinCleanup} from './field-cleanup.mjs';

export {twoTurnMoveState,mustRechargeState,validateMoveCommitmentChoice,abortTwoTurnMove,resolveRechargeAction} from './move-commitments.mjs';
export {prepareTwoTurnMoveHandler} from './handlers/prepare-two-turn-move.mjs';
export {modifyChargePowerHandler} from './handlers/modify-charge-power.mjs';
export {applyRechargeHandler} from './handlers/apply-recharge.mjs';

export {SEMI_INVULNERABLE_MODES as SEMI_INVULNERABILITY_MODES,semiInvulnerableState,semiInvulnerabilityInteraction,applySemiInvulnerabilityHitEffect} from './semi-invulnerability.mjs';

export {modifyMoveByAbility,resolveTargetAbilityBlock,abilityPowerModifiers,abilityStatModifiers,abilityIncomingAccuracyModifier,abilityStatusBlock,abilityWeatherResidualDamageGroup,resolveEndTurnAbilityAllyStatusCures,resolveEndTurnAbilityBerryRestores,abilityBerryConsumptionHeal,abilityBerryEffectMultiplier,globalMoveAbilityBlock,globalContactFaintResponseBlock,abilitySleepCounterRate,abilityStatDropReflection,applyAbilityStatDropReflection,abilityPreventsIndirectDamage,abilitySideConditionBypass,abilityParentalBond,abilityProtectionPierce,opponentSwitchTrap} from './ability-hooks.mjs';
export {resolveBeforeMoveAbilityState,resolveAfterMoveAbilityState} from './ability-action-state.mjs';
export {applyFormProfile,resolveFieldTypeAbilities,resolvePreMoveFormAbilities,resolveSwitchOutAbilityForms,resolveEndTurnAbilityForms,applyDisguiseShield} from './ability-form.mjs';
export {applyTransformState,restoreTransformState,resolveEntryTransformAbility,resolveEntryIllusionAbility,breakIllusionOnDamage,clearIllusionState,transformBlockedReason} from './ability-transform.mjs';
export {resolveStatusMoveReflection,opponentAbilitiesIgnoredFor,statusMoveReflectable,statusMoveReflectionForTarget} from './ability-targeting.mjs';
export {applySubstitute,applySubstituteDamage,substituteBlocksStatusMove,substituteBypassed} from './substitute.mjs';
export {effectiveWeatherId,effectiveWeatherForUnit,weatherEffectsSuppressed} from './ability-field.mjs';

export {resolveOutgoingAbilitySecondaries} from './ability-outgoing.mjs';
export {effectiveBattleSpeed} from './speed.mjs';
export {prepareTurnOrderAbilities,prepareTurnOrderMechanics} from './turn-order-effects.mjs';

export {abilityStageChange,abilityIgnoresOpponentStage} from './ability-stage-change.mjs';
export {resolveOpponentStatGainCopyAbilities} from './ability-stage-response.mjs';

export {resolvePostMoveItemTransferAbilities} from './ability-item-transfer.mjs';
export {activeAbilityId,replaceActiveAbility,suppressActiveAbility,swapActiveAbilities,restoreTransientAbility,resolveEntryAbilityCopies,resolveAllyFaintAbilityCopies,resolveFaintAbilityCopiesFromEvents,resolveContactAbilityReplacement} from './ability-replacement.mjs';

export {applyGravity,gravityActive,gravityBlocksMove,gravityAccuracyMultiplier,GRAVITY_BLOCKED_MOVE_IDS} from './gravity.mjs';

export {clearDestinyBondBeforeMove,resolveDestinyBondKo} from './destiny-bond.mjs';

export {battleFoundation,speciesFoundation,itemFoundation,canFlingItem,flingItemMetadata,effectiveWeightKg,deterministicBattleGender,hydrateSpeciesFoundation,hydrateCatalogFoundation} from './foundation-data.mjs';

export {preparePersistentEffectsEndTurn} from './persistent-effects.mjs';
