// The Shop screen can only construct a reviewed purchase shape. Persisted saves
// and old client payloads still receive independent server-side validation.
/**
 * @param {{itemId:unknown,payment:'coins'|'ticket',actionId:unknown}} input
 * @returns {import('./types/reviewed-actions.d.ts').ShopPurchase|null}
 */
export function createShopPurchase({itemId,payment,actionId}){
 if(typeof itemId!=='string'||!itemId.trim()||itemId.length>128)return null;
 if(payment!=='coins'&&payment!=='ticket')return null;
 if(typeof actionId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(actionId))return null;
 return {type:'shopV3.buy',itemId,payment,actionId};
}
