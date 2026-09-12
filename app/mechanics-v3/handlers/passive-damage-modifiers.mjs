import {clone} from '../../rules-v3/battle-state.mjs';

const create=id=>({id,hooks:['modifyDamage'],run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,passiveEffectDeclarations:[...(payload.passiveEffectDeclarations||[]),{id,...params}]},events:[]};}});

export const lowHpTypeBoostHandler=create('low-hp-type-boost');
export const heldDamageBoostHandler=create('held-damage-boost');
