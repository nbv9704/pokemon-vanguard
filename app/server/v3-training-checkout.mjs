import {v3TrainingCost} from './v3-progression.mjs';
import {applyEconomyTransaction} from './v2-economy-ledger.mjs';

// Called only after build validation, with an uncommitted copy of the adventure state.
// Revision checks and the account action queue prevent buying the same training twice.
export function checkoutV3Training(next,current,updated,action){
 const cost=v3TrainingCost(current,updated),payment=action.payment||'coins';
 if(!['coins','ticket'].includes(payment))return {ok:false,code:'INVALID_TRAINING_PAYMENT'};
 if(payment==='ticket'&&!cost.total)return {ok:false,code:'TICKET_NOT_REQUIRED'};
 if(cost.total){
  const tx=applyEconomyTransaction(next,{
   receiptId:`buildV3.training:${updated.buildId}:${updated.revision}`,
   actionId:action.actionId||null,kind:'buildV3.training',
   delta:payment==='ticket'?{trainingTickets:-1}:{coins:-cost.total},details:{...cost,payment}
  });
  if(!tx.ok)return tx;
 }
 next.notice=cost.total?(payment==='ticket'?'Training complete · one Training Ticket used.':`Training complete · ${cost.total.toLocaleString()} VP spent.`):'Build saved.';
 return {ok:true,cost,payment};
}
