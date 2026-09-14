import {clone} from '../../rules-v3/battle-state.mjs';

const declaration=(id,hooks)=>({id,hooks,run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const weatherStatBoostHandler=declaration('weather-stat-boost',['modifyAttack']);
export const weatherResidualDamageHandler=declaration('weather-residual-damage',['endTurn']);
export const weatherStatusImmunityHandler=declaration('weather-status-immunity',['beforeTarget']);
export const weatherTypeDamageBoostHandler=declaration('weather-type-damage-boost',['modifyDamage']);
export const weatherResidualImmunityHandler=declaration('weather-residual-immunity',['endTurn']);
export const weatherIncomingAccuracyModifierHandler=declaration('weather-incoming-accuracy-modifier',['modifyAccuracy']);
export const typeImmunityBoostHandler=declaration('type-immunity-boost',['beforeTarget','modifyPower']);

export const typeImmunityResponseHandler=declaration('type-immunity-response',['beforeTarget']);
export const contactResponseHandler=declaration('contact-response',['afterDamage']);
export const damageResponseHandler=declaration('damage-response',['afterDamage']);
export const koStatBoostHandler=declaration('ko-stat-boost',['onFaint']);
export const endTurnStatBoostHandler=declaration('end-turn-stat-boost',['endTurn']);
export const lethalHitSurvivalHandler=declaration('lethal-hit-survival',['modifyDamage']);
export const statDropResponseHandler=declaration('stat-drop-response',['afterStatChange']);
export const volatileImmunityHandler=declaration('volatile-immunity',['beforeTarget']);
export const criticalVsStatusHandler=declaration('critical-vs-status',['modifyDamage']);
export const statusResidualHealHandler=declaration('status-residual-heal',['endTurn']);
export const statusReflectHandler=declaration('status-reflect',['afterStatus']);
export const flinchStatBoostHandler=declaration('flinch-stat-boost',['afterStatus']);
export const criticalDamageBoostHandler=declaration('critical-damage-boost',['modifyDamage']);
export const basePowerThresholdBoostHandler=declaration('base-power-threshold-boost',['modifyPower']);
export const moveTagPowerBoostHandler=declaration('move-tag-power-boost',['modifyPower']);
export const moveTagImmunityHandler=declaration('move-tag-immunity',['beforeTarget']);
export const removeContactHandler=declaration('remove-contact',['beforeAction']);
export const moveTypeByTagHandler=declaration('move-type-by-tag',['beforeAction']);

export const secondaryEffectPowerBoostHandler=declaration('secondary-effect-power-boost',['beforeAction','modifyPower']);

export const statMultiplierHandler=declaration('stat-multiplier',['modifyAttack','modifyDefense','modifySpeed']);
export const outgoingAccuracyModifierHandler=declaration('outgoing-accuracy-modifier',['modifyAccuracy']);
export const contactPowerBoostHandler=declaration('contact-power-boost',['modifyPower']);
export const recoilPowerBoostHandler=declaration('recoil-power-boost',['modifyPower']);
export const majorStatusImmunityHandler=declaration('major-status-immunity',['beforeTarget']);
export const criticalRatioHandler=declaration('critical-ratio',['modifyDamage']);
export const criticalImmunityHandler=declaration('critical-immunity',['modifyDamage']);
export const stabModifierHandler=declaration('stab-modifier',['modifyDamage']);
export const recoilImmunityHandler=declaration('recoil-immunity',['afterDamage']);
export const receivedDamageModifierHandler=declaration('received-damage-modifier',['modifyDamage']);
export const alwaysHitHandler=declaration('always-hit',['modifyAccuracy']);
export const burnAttackPenaltyImmunityHandler=declaration('burn-attack-penalty-immunity',['modifyDamage']);

export const statDropImmunityHandler=declaration('stat-drop-immunity',['afterStatChange']);
export const allyDamageImmunityHandler=declaration('ally-damage-immunity',['beforeTarget']);
export const allyDamageReductionHandler=declaration('ally-damage-reduction',['modifyDamage']);
export const allyAbilityStatMultiplierHandler=declaration('ally-ability-stat-multiplier',['modifyAttack']);
export const secondaryEffectImmunityHandler=declaration('secondary-effect-immunity',['beforeTarget']);
export const multiHitMaxHandler=declaration('multi-hit-max',['onMove']);
export const weatherStatusCureHandler=declaration('weather-status-cure',['endTurn']);
export const paralysisSpeedPenaltyImmunityHandler=declaration('paralysis-speed-penalty-immunity',['modifySpeed']);
export const switchOutStatusCureHandler=declaration('switch-out-status-cure',['onSwitchOut']);
export const switchOutHealHandler=declaration('switch-out-heal',['onSwitchOut']);
export const randomStatusCureHandler=declaration('random-status-cure',['endTurn']);
export const entryWeatherHandler=declaration('entry-weather',['onEntry']);
export const entryStatDropHandler=declaration('entry-stat-drop',['onEntry']);
export const entryScreenCleanerHandler=declaration('entry-screen-cleaner',['onEntry']);

export const entryAllyStageResetHandler=declaration('entry-ally-stage-reset',['onEntry']);
export const entryAllyHealHandler=declaration('entry-ally-heal',['onEntry']);
export const volatileIncomingAccuracyModifierHandler=declaration('volatile-incoming-accuracy-modifier',['modifyAccuracy']);
export const statusTypeImmunityBypassHandler=declaration('status-type-immunity-bypass',['beforeTarget']);
export const priorityMoveImmunityAuraHandler=declaration('priority-move-immunity-aura',['beforeTarget']);
export const allyMajorStatusImmunityHandler=declaration('ally-major-status-immunity',['beforeTarget']);
export const allyStatDropImmunityHandler=declaration('ally-stat-drop-immunity',['afterStatChange']);
export const receivedTypeDamageModifierHandler=declaration('received-type-damage-modifier',['modifyDamage']);
