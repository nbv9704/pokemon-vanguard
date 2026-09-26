import {applyEconomyTransaction,ensureEconomyState,inspectActionReceipt,recordActionReceipt,validateEconomyActionId} from './v2-economy-ledger.mjs';
import {V3_BEGINNING_ITEM_IDS,V3_ITEM_ACQUISITION_SOURCE,v3ItemAcquisition} from './v3-item-acquisition.mjs';

const clone=value=>structuredClone(value);
export const isV3ShopAction=action=>action?.type==='shopV3.buy';
const fingerprint=action=>JSON.stringify({type:'shopV3.buy',itemId:action.itemId,payment:action.payment||'coins'});

export function ensureV3ItemInventory(progression,catalog,{preserveEquipped=true}={}){
 if(!progression)return {progression,changed:false};
 const valid=new Set(catalog.items.filter(item=>item.enabledForBattle).map(item=>item.id)),current=Array.isArray(progression.ownedItemIds)?progression.ownedItemIds:[],owned=new Set(current.filter(id=>valid.has(id)));
 for(const id of V3_BEGINNING_ITEM_IDS)if(valid.has(id))owned.add(id);
 if(preserveEquipped)for(const build of progression.builds||[])if(valid.has(build.itemId))owned.add(build.itemId);
 const next=[...owned],changed=progression.itemInventoryVersion!==1||JSON.stringify(next)!==JSON.stringify(current);
 progression.ownedItemIds=next;progression.itemInventoryVersion=1;return {progression,changed};
}

export function v3OwnsItem(progression,itemId){return Array.isArray(progression?.ownedItemIds)&&progression.ownedItemIds.includes(itemId);}

export function applyV3ShopAction(state,action,catalog){
 if(!isV3ShopAction(action))return {ok:false,code:'UNKNOWN_SHOP_ACTION'};
 if(!validateEconomyActionId(action.actionId))return {ok:false,code:'ACTION_ID_REQUIRED'};
 const base=clone(state);ensureEconomyState(base);if(!base.progressionV3)return {ok:false,code:'SCHEMA_V3_NOT_READY'};ensureV3ItemInventory(base.progressionV3,catalog);
 const key=fingerprint(action),prior=inspectActionReceipt(base,action.actionId,key);if(prior.status==='conflict')return {ok:false,code:'ACTION_ID_REUSED'};if(prior.status==='duplicate')return {ok:true,state:base,duplicate:true,receipt:clone(prior.receipt.result)};
 const payment=action.payment||'coins';if(!['coins','ticket'].includes(payment))return {ok:false,code:'INVALID_SHOP_PAYMENT'};
 const item=catalog.itemsById[action.itemId],acquisition=v3ItemAcquisition(item);if(!item?.enabledForBattle)return {ok:false,code:'ITEM_NOT_FOUND'};if(acquisition?.kind!=='shop')return {ok:false,code:'ITEM_NOT_FOR_SALE'};if(v3OwnsItem(base.progressionV3,item.id))return {ok:false,code:'ITEM_ALREADY_OWNED'};
 const tx=applyEconomyTransaction(base,{receiptId:`shopV3:${item.id}:${action.actionId}`,actionId:action.actionId,kind:'shopV3.buy',delta:payment==='ticket'?{shopTickets:-1}:{coins:-acquisition.priceCoins},details:{itemId:item.id,itemName:item.name,source:V3_ITEM_ACQUISITION_SOURCE,payment}});if(!tx.ok)return tx;
 base.progressionV3.ownedItemIds.push(item.id);base.progressionV3.revision=(base.progressionV3.revision||0)+1;base.revision=(base.revision||0)+1;base.notice=payment==='ticket'?`${item.name} unlocked using one Shop Ticket.`:`${item.name} purchased · ${acquisition.priceCoins.toLocaleString()} VP spent.`;
 const receipt={receiptId:tx.entry.receiptId,kind:action.type,itemId:item.id,priceCoins:payment==='ticket'?0:acquisition.priceCoins,payment,balance:clone(base.wallet)};recordActionReceipt(base,{actionId:action.actionId,kind:action.type,fingerprint:key,receiptId:receipt.receiptId,result:receipt});return {ok:true,state:base,duplicate:false,receipt:clone(receipt)};
}

export function v3ShopView(state,catalog){
 if(!state?.progressionV3)return null;ensureEconomyState(state);
 const owned=new Set(state.progressionV3.ownedItemIds||[]),items=catalog.items.filter(item=>item.enabledForBattle).map(item=>{const acquisition=v3ItemAcquisition(item);return {id:item.id,name:item.name,description:item.description,category:item.category,owned:owned.has(item.id),source:acquisition.kind,sourceLabel:acquisition.label,priceCoins:acquisition.priceCoins,purchasable:acquisition.kind==='shop'&&!owned.has(item.id)};});
 return {schemaVersion:1,source:V3_ITEM_ACQUISITION_SOURCE,balanceCoins:state.wallet.coins,shopTickets:state.ticketBagV1?.shopTickets||0,ownedCount:items.filter(item=>item.owned).length,totalCount:items.length,items};
}
