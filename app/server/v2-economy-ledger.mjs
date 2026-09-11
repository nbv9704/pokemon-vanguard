const clone=value=>JSON.parse(JSON.stringify(value));
const actionIdPattern=/^[A-Za-z0-9:_-]{1,128}$/;

export function ensureEconomyState(state){
 const coins=Math.max(0,Math.trunc(state.wallet?.coins??state.coins??0)),crystals=Math.max(0,Math.trunc(state.wallet?.crystals??state.gems??0)),recruitmentTickets=Math.max(0,Math.trunc(state.wallet?.recruitmentTickets??state.recruitmentTickets??0));
 state.wallet={coins,crystals,recruitmentTickets};state.coins=coins;state.gems=crystals;state.recruitmentTickets=recruitmentTickets;
 state.rngState=state.rngState&&typeof state.rngState==='object'?state.rngState:{};
 if(!Number.isInteger(state.rngState.economy))state.rngState.economy=(state.seed>>>0)||1;
 state.economyLedger=Array.isArray(state.economyLedger)?state.economyLedger:[];
 state.actionReceipts=Array.isArray(state.actionReceipts)?state.actionReceipts:[];
 state.mailClaims=Array.isArray(state.mailClaims)?state.mailClaims:[];
 state.rewardReceipts=Array.isArray(state.rewardReceipts)?state.rewardReceipts:[];
 return state;
}

export function economyActionFingerprint(action){
 if(action.type==='mail.claim')return JSON.stringify({type:'mail.claim',mailId:action.mailId});
 return JSON.stringify({type:action.type});
}

export function validateEconomyActionId(actionId){return typeof actionId==='string'&&actionIdPattern.test(actionId);}

export function inspectActionReceipt(state,actionId,fingerprint){
 ensureEconomyState(state);const existing=state.actionReceipts.find(entry=>entry.actionId===actionId);
 if(!existing)return {status:'new'};
 if(existing.fingerprint!==fingerprint)return {status:'conflict',receipt:clone(existing)};
 return {status:'duplicate',receipt:clone(existing)};
}

export function recordActionReceipt(state,{actionId,kind,fingerprint,receiptId,result}){
 ensureEconomyState(state);const existing=state.actionReceipts.find(entry=>entry.actionId===actionId);if(existing)return clone(existing);
 const entry={actionId,kind,fingerprint,receiptId,result:clone(result)};state.actionReceipts.push(entry);return clone(entry);
}

export function applyEconomyTransaction(state,{receiptId,actionId=null,kind,delta,details=null}){
 ensureEconomyState(state);const existing=state.economyLedger.find(entry=>entry.receiptId===receiptId);if(existing)return {ok:true,duplicate:true,entry:clone(existing)};
 const normalized={coins:Math.trunc(delta?.coins||0),crystals:Math.trunc(delta?.crystals||0),recruitmentTickets:Math.trunc(delta?.recruitmentTickets||0)},before=clone(state.wallet),after={coins:before.coins+normalized.coins,crystals:before.crystals+normalized.crystals,recruitmentTickets:before.recruitmentTickets+normalized.recruitmentTickets};
 if(after.coins<0||after.crystals<0||after.recruitmentTickets<0)return {ok:false,code:after.coins<0?'INSUFFICIENT_COINS':after.crystals<0?'INSUFFICIENT_CRYSTALS':'INSUFFICIENT_RECRUITMENT_TICKETS'};
 state.wallet=after;state.coins=after.coins;state.gems=after.crystals;state.recruitmentTickets=after.recruitmentTickets;
 const entry={receiptId,actionId,kind,delta:normalized,balanceBefore:before,balanceAfter:clone(after),details:clone(details)};state.economyLedger.push(entry);return {ok:true,duplicate:false,entry:clone(entry)};
}
