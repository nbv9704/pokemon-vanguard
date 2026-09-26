import {ensureTicketBag} from './ticket-bag.mjs';
import {applyEconomyTransaction} from './v2-economy-ledger.mjs';

// Keep a lost match in Ranked history, but change the RP delta to 0 when armed.
// Only consume on a real RP loss; winning, drawing and 0-RP floor do not waste a ticket.
export function protectRankedLoss(state,matchId,delta){
 const bag=ensureTicketBag(state);
 if(delta>=0||!bag.rankProtectionArmed||!bag.rankTickets||!(state.rankedV1?.rating>0))return {delta,protected:false};
 const tx=applyEconomyTransaction(state,{receiptId:`rank-ticket:${matchId}`,kind:'ranked.rank-protection',delta:{rankTickets:-1},details:{matchId,preventedRatingLoss:-delta}});
 if(!tx.ok)return {delta,protected:false};
 bag.rankProtectionArmed=false;return {delta:0,protected:true};
}
