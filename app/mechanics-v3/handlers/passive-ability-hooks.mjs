import {clone} from '../../rules-v3/battle-state.mjs';

const declaration=(id,hooks)=>({id,hooks,run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const weatherStatBoostHandler=declaration('weather-stat-boost',['modifyAttack']);
export const weatherResidualDamageHandler=declaration('weather-residual-damage',['endTurn']);
export const weatherStatusImmunityHandler=declaration('weather-status-immunity',['beforeTarget']);
export const typeImmunityBoostHandler=declaration('type-immunity-boost',['beforeTarget','modifyPower']);
export const criticalDamageBoostHandler=declaration('critical-damage-boost',['modifyDamage']);
export const basePowerThresholdBoostHandler=declaration('base-power-threshold-boost',['modifyPower']);
export const moveTagPowerBoostHandler=declaration('move-tag-power-boost',['modifyPower']);
export const moveTagImmunityHandler=declaration('move-tag-immunity',['beforeTarget']);
export const removeContactHandler=declaration('remove-contact',['beforeAction']);
export const moveTypeByTagHandler=declaration('move-type-by-tag',['beforeAction']);

export const secondaryEffectPowerBoostHandler=declaration('secondary-effect-power-boost',['beforeAction','modifyPower']);
