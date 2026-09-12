import {clone} from '../../rules-v3/battle-state.mjs';

export const megaStoneHandler={id:'mega-stone',hooks:['beforeAction'],run({battle,payload}){return {battle:clone(battle),payload:{...payload},events:[]};}};
