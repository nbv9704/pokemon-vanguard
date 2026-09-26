import {applyEconomyTransaction} from './v2-economy-ledger.mjs';
import {markSystemMailClaimed,systemMailLifecycle} from './mailbox-v1.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
function eligible(state,mail){const rule=mail.eligibility;if(rule.kind==='always')return true;if(rule.kind==='winsAtLeast')return Math.max(0,Math.trunc(state.wins||0))>=rule.value;if(rule.kind==='badgesAtLeast')return (state.badges||state.gymProgress?.badges||[]).length>=rule.value;return false;}
export function applyMailClaim(state,action,catalog,{now=Date.now()}={}){
 const mail=catalog.economy.mail.find(entry=>entry.mailId===action.mailId);if(!mail)return {ok:false,code:'MAIL_NOT_FOUND'};
 const lifecycle=systemMailLifecycle(state,mail.mailId,{now});if(!lifecycle)return {ok:false,code:'MAIL_NOT_FOUND'};if(lifecycle.expired)return {ok:false,code:'MAIL_EXPIRED'};
 if((state.mailClaims||[]).includes(mail.mailId)||(state.mail||[]).includes(mail.mailId))return {ok:false,code:'MAIL_ALREADY_CLAIMED'};
 if(!eligible(state,mail))return {ok:false,code:'MAIL_NOT_ELIGIBLE'};
 const receiptId=`mail:${state.owner}:${mail.mailId}`,transaction=applyEconomyTransaction(state,{receiptId,actionId:action.actionId,kind:'mail-claim',delta:mail.reward,details:{mailId:mail.mailId,key:mail.key}});if(!transaction.ok)return transaction;
 state.mailClaims=Array.isArray(state.mailClaims)?state.mailClaims:[];state.mailClaims.push(mail.mailId);state.mail=Array.isArray(state.mail)?state.mail:[];if(!state.mail.includes(mail.mailId))state.mail.push(mail.mailId);state.mail.sort((a,b)=>a-b);const marked=markSystemMailClaimed(state,mail.mailId,now);if(!marked.ok)return marked;state.reveal=[];state.notice='Mailbox rewards claimed.';
 return {ok:true,receipt:{receiptId,kind:'mail-claim',mailId:mail.mailId,reward:clone(mail.reward),balance:clone(state.wallet)}};
}
