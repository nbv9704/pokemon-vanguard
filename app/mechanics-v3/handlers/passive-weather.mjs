import {clone} from '../../rules-v3/battle-state.mjs';

const declaration=(id,hooks)=>({id,hooks,run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const weatherSpeedHandler=declaration('weather-speed',['modifySpeed']);
export const weatherDurationHandler=declaration('weather-duration',['onMove']);
export const weatherHealHandler=declaration('weather-heal',['endTurn']);
