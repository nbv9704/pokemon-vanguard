import {clone} from '../../rules-v3/battle-state.mjs';

export const terrainDurationHandler={id:'terrain-duration',hooks:['onMove'],run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id:'terrain-duration',...params}]},events:[]};}};
