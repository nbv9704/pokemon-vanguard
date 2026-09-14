import {clone} from '../../rules-v3/battle-state.mjs';

const declaration=(id,hooks)=>({id,hooks,run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const itemEndTurnHealHandler=declaration('item-end-turn-heal',['endTurn']);
export const itemThresholdHealHandler=declaration('item-threshold-heal',['afterDamage']);
export const itemSurviveLethalHitHandler=declaration('item-survive-lethal-hit',['onDamage']);
export const itemStatusCureHandler=declaration('item-status-cure',['afterStatus']);
