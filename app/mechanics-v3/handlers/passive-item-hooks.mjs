import {clone} from '../../rules-v3/battle-state.mjs';

const declaration=(id,hooks)=>({id,hooks,run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const itemEndTurnHealHandler=declaration('item-end-turn-heal',['endTurn']);
export const itemThresholdHealHandler=declaration('item-threshold-heal',['afterDamage']);
export const itemSurviveLethalHitHandler=declaration('item-survive-lethal-hit',['onDamage']);
export const itemResistHitHandler=declaration('item-resist-hit',['onDamage']);
export const itemStatusCureHandler=declaration('item-status-cure',['afterStatus']);
export const itemNegativeStageResetHandler=declaration('item-negative-stage-reset',['afterStatChange']);
export const itemPostMoveRecoilHandler=declaration('item-post-move-recoil',['afterDamage']);
export const itemContactRetaliationHandler=declaration('item-contact-retaliation',['afterDamage']);
export const itemDamageHealHandler=declaration('item-damage-heal',['afterDamage']);

export const itemSpeedBoostHandler=declaration('item-speed-boost',['modifySpeed']);
export const itemSpeedModifierHandler=declaration('item-speed-modifier',['modifySpeed']);
export const itemAccuracyBoostHandler=declaration('item-accuracy-boost',['modifyAccuracy']);
export const itemAccuracyAfterTargetHandler=declaration('item-accuracy-after-target',['modifyAccuracy']);
export const itemIncomingAccuracyModifierHandler=declaration('item-incoming-accuracy-modifier',['modifyAccuracy']);
export const itemCriticalRatioHandler=declaration('item-critical-ratio',['onDamage']);
export const itemChoiceLockHandler=declaration('item-choice-lock',['onMove']);
export const itemHealingBoostHandler=declaration('item-healing-boost',['afterDamage']);
export const itemTerrainSeedHandler=declaration('item-terrain-seed',['onEntry','afterStatChange']);
export const itemPpRestoreHandler=declaration('item-pp-restore',['beforeAction']);
export const itemAirborneHandler=declaration('item-airborne',['onEntry','onDamage']);
export const itemGroundingHandler=declaration('item-grounding',['onEntry']);
export const itemForceAttackerSwitchHandler=declaration('item-force-attacker-switch',['afterDamage']);
export const itemOneShotDamageBoostHandler=declaration('item-one-shot-damage-boost',['modifyPower']);
export const itemSpeciesStatModifierHandler=declaration('item-species-stat-modifier',['modifyAttack']);
export const itemSpeciesCriticalRatioHandler=declaration('item-species-critical-ratio',['onDamage']);
export const itemConsecutiveMovePowerHandler=declaration('item-consecutive-move-power',['modifyPower']);
export const itemFlinchChanceHandler=declaration('item-flinch-chance',['afterDamage']);
export const itemVolatileCureHandler=declaration('item-volatile-cure',['afterStatus']);
export const itemQuickOrderHandler=declaration('item-quick-order',['onTurnOrder']);
