import {clone} from '../../rules-v3/battle-state.mjs';

export const rejectUnusableItemHandler={
 id:'reject-unusable-item',hooks:['beforeAction'],
 run({battle,payload,params}){return {battle:clone(battle),payload:{...payload,itemUnavailable:true,itemUnavailableReason:params?.reason||'unavailable'},events:[{kind:'itemUnavailable',itemId:payload?.itemId||null,reason:params?.reason||'unavailable'}]};}
};
