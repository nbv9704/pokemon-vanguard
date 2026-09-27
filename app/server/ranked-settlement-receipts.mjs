// Persist the player-visible outcome with the same two-account Ranked commit.
// Match history is display-only and may be trimmed; receipts are the durable
// replay barrier until an equivalent long-lived dedupe archive is available.
import {createHash} from 'node:crypto';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const rankedSettlementKey=({matchId,mode,winner,accountA,accountB})=>createHash('sha256').update(JSON.stringify(canonical({matchId,mode,winner,accountA,accountB}))).digest('hex');
export function rankedSettlementReceipt(state,matchId){return state?.rankedSettlementReceiptsV1?.find(entry=>entry.matchId===matchId)||null;}
export function recordRankedSettlement(state,{matchId,key,outcome,reason,mode,opponentName,opponentRating,ratingDelta,ratingAfter,rankTicketProtected,settledAt}){
 if(!Array.isArray(state.rankedSettlementReceiptsV1))state.rankedSettlementReceiptsV1=[];
 if(rankedSettlementReceipt(state,matchId))throw Object.assign(Error('Ranked settlement already recorded'),{code:'RANKED_SETTLEMENT_ALREADY_RECORDED'});
 const receipt={matchId,key,mode,settledAt,opponentName:String(opponentName||'Trainer').slice(0,80),opponentRating,result:{outcome,reason,ratingDelta,ratingAfter,rankTicketProtected:!!rankTicketProtected}};
 state.rankedSettlementReceiptsV1.push(receipt);return receipt;
}
export function recentRankedSettlement(state,now,retentionMs){
 const list=state?.rankedSettlementReceiptsV1;if(!Array.isArray(list))return null;
 // An older unfinished result must not reappear after dismissing a newer one.
 const entry=list.at(-1);
 return entry&&!entry.dismissedAt&&Number.isFinite(entry.settledAt)&&entry.settledAt<=now&&now-entry.settledAt<retentionMs?entry:null;
}
