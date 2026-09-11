import {applyMailClaim} from './v2-mail.mjs';
import {economyActionFingerprint,ensureEconomyState,inspectActionReceipt,recordActionReceipt,validateEconomyActionId} from './v2-economy-ledger.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));

export function canonicalEconomyAction(action){
 if(action?.type==='claim')return {...action,type:'mail.claim',mailId:action.id};
 return action;
}
export function isV2EconomyAction(action){return canonicalEconomyAction(action)?.type==='mail.claim';}

export function applyV2EconomyAction(state,input,catalog){
 const action=canonicalEconomyAction(input);if(!isV2EconomyAction(action))return {ok:false,code:'UNKNOWN_ECONOMY_ACTION'};
 if(!validateEconomyActionId(action.actionId))return {ok:false,code:'ACTION_ID_REQUIRED'};
 const base=clone(state);ensureEconomyState(base);base.reveal=[];const fingerprint=economyActionFingerprint(action),prior=inspectActionReceipt(base,action.actionId,fingerprint);
 if(prior.status==='conflict')return {ok:false,code:'ACTION_ID_REUSED'};
 if(prior.status==='duplicate')return {ok:true,state:base,duplicate:true,receipt:clone(prior.receipt.result)};
 const result=applyMailClaim(base,action,catalog);if(!result.ok)return result;
 recordActionReceipt(base,{actionId:action.actionId,kind:action.type,fingerprint,receiptId:result.receipt.receiptId,result:result.receipt});
 return {ok:true,state:base,duplicate:false,receipt:clone(result.receipt)};
}
