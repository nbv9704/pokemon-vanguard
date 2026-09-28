// Public facade for held-item mechanics.
// Keep external imports stable while implementation is split by responsibility.
export {
 createHeldItemState,heldItemId,heldItemEffectActive,removeHeldItem,swapHeldItems,transferHeldItem,
 activateHeldItem,hasConsumedBerry,consumeHeldItemForFling,applyThrownBerryEffects,consumeHeldBerry,
 recycleConsumedItem,revealHeldItem,heldItemHasEffect
} from './item-hooks/state.mjs';
export {
 typeEffectivenessWithHeldItems,speedWithHeldItems,statWithHeldItems,accuracyWithHeldItems,
 healingWithHeldItems,criticalChanceWithHeldItems,validateChoiceItemMove,applyChoiceItemMoveLock
} from './item-hooks/modifiers.mjs';
export {resolveHpThresholdItems} from './item-hooks/threshold.mjs';
export {
 applyResistanceBerryToMoveDamage,applySurvivalItemToMoveDamage,
 resolvePostDamageItems,resolveContactDamageItems,resolveAfterMoveItems,resolveTerrainSeedItems,
 resolvePpRestoreItems,resolveEntryItems,prepareOneShotMoveDamageItem,prepareConsecutiveMoveItem,
 resolveFlinchItems,resolveReactiveSwitchItems,prepareTurnOrderItems
} from './item-hooks/combat.mjs';
export {
 resolveNegativeStageResetItems,resolveStatusCureItems,resolveVolatileCureItems,
 resolveEndTurnItemAbilityLifecycle,resolveEndTurnItems
} from './item-hooks/status-lifecycle.mjs';
