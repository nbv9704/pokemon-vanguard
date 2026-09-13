import {clone} from '../../rules-v3/battle-state.mjs';

export const screenDurationHandler={id:'screen-duration',hooks:['onMove'],run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id:'screen-duration',...params}]},events:[]};}};
