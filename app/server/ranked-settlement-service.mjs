// Durable pair settlement: load receipt after lost ACK, persist before publish.
import {rankedSettlementKey,rankedSettlementReceipt,recordRankedSettlement} from './ranked-settlement-receipts.mjs';
import {protectRankedLoss} from './rank-ticket-settlement.mjs';
import {ensureRankedState,rankedRatingDelta,settleProfile} from './ranked-profile.mjs';
const clone=value=>structuredClone(value);
export async function commitRankedSettlement(match){
 const winner=match.battle?.result?.winner||match.forfeitWinner||null,a=match.participants.A,b=match.participants.B,aState=this.getState(a.accountId),bState=this.getState(b.accountId);if(!aState||!bState)throw new Error('Ranked settlement state unavailable');
 const key=rankedSettlementKey({matchId:match.id,mode:match.mode,winner,accountA:a.accountId,accountB:b.accountId});
 if(this.loadState){
  const [savedA,savedB]=await Promise.all([this.loadState(a.accountId),this.loadState(b.accountId)]);
  const proofA=rankedSettlementReceipt(savedA,match.id),proofB=rankedSettlementReceipt(savedB,match.id);
  if(proofA||proofB){if(!proofA||!proofB||proofA.key!==key||proofB.key!==key)throw Object.assign(Error('Ranked settlement receipt mismatch; manual recovery required'),{code:'RANKED_SETTLEMENT_RECEIPT_CONFLICT'});
   this.publish(a.accountId,savedA,aState);this.publish(b.accountId,savedB,bState);
   match.rankTicketProtected={A:proofA.result.rankTicketProtected,B:proofB.result.rankTicketProtected};match.ratingDelta={A:proofA.result.ratingDelta,B:proofB.result.ratingDelta};match.ratingAfter={A:proofA.result.ratingAfter,B:proofB.result.ratingAfter};match.settled=true;match.settledAt=proofA.settledAt;match.decisionClock=null;return;
  }
 }
 const aNext=clone(aState),bNext=clone(bState);ensureRankedState(aNext);ensureRankedState(bNext);const scoreA=winner==='A'?1:winner==='B'?0:.5,delta=rankedRatingDelta(aNext.rankedV1.rating,bNext.rankedV1.rating,scoreA),now=this.clock.now(),aBefore=aNext.rankedV1.rating,bBefore=bNext.rankedV1.rating;
 const shieldA=protectRankedLoss(aNext,match.id,delta.A),shieldB=protectRankedLoss(bNext,match.id,delta.B);
 settleProfile(aNext,{matchId:match.id,opponentName:b.name,opponentRating:bBefore,score:scoreA,delta:shieldA.delta,now,mode:match.mode,protected:shieldA.protected});
 settleProfile(bNext,{matchId:match.id,opponentName:a.name,opponentRating:aBefore,score:1-scoreA,delta:shieldB.delta,now,mode:match.mode,protected:shieldB.protected});
 const reason=match.battle?.result?.reason||match.forfeitReason||'completed';
 recordRankedSettlement(aNext,{matchId:match.id,key,outcome:winner==='A'?'win':winner==='B'?'loss':'draw',reason,mode:match.mode,opponentName:b.name,opponentRating:bBefore,ratingDelta:shieldA.delta,ratingAfter:aNext.rankedV1.rating,rankTicketProtected:shieldA.protected,settledAt:now});
 recordRankedSettlement(bNext,{matchId:match.id,key,outcome:winner==='B'?'win':winner==='A'?'loss':'draw',reason,mode:match.mode,opponentName:a.name,opponentRating:aBefore,ratingDelta:shieldB.delta,ratingAfter:bNext.rankedV1.rating,rankTicketProtected:shieldB.protected,settledAt:now});
 if(this.persistPair)await this.persistPair([{userId:a.accountId,state:aNext},{userId:b.accountId,state:bNext}],`ranked:settlement:${match.id}`);else await Promise.all([this.persist(a.accountId,aNext),this.persist(b.accountId,bNext)]);this.publish(a.accountId,aNext,aState);this.publish(b.accountId,bNext,bState);
 match.rankTicketProtected={A:shieldA.protected,B:shieldB.protected};match.ratingDelta={A:shieldA.delta,B:shieldB.delta};match.ratingAfter={A:aNext.rankedV1.rating,B:bNext.rankedV1.rating};match.settled=true;match.settledAt=now;match.decisionClock=null;}
