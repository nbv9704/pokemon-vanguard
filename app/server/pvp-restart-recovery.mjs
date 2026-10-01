// Durable marker for the supported single-coordinator beta policy.
// We intentionally do not persist hidden commands or battle snapshots: after a
// process restart an active Ranked match becomes a no-contest, never a resume.
import {rankedSettlementKey,rankedSettlementReceipt,recordRankedSettlement} from './ranked-settlement-receipts.mjs';
import {ensureRankedState} from './ranked-profile.mjs';

const clone=value=>structuredClone(value),FIELD='activeRankedMatchV1';
const failure=(code,message)=>Object.assign(new Error(message||code),{code});
function participant(match,side){const value=match.participants?.[side];if(!value?.accountId)throw failure('PVP_RECOVERY_MATCH_INVALID');return {accountId:value.accountId,name:String(value.name||'Trainer').slice(0,80),rating:Number.isFinite(value.rating)?value.rating:1000};}
function validMarker(value){return value?.version===1&&value.kind==='ranked'&&typeof value.matchId==='string'&&value.matchId.startsWith('ranked-')&&['single','double'].includes(value.mode)&&value.participants?.A?.accountId&&value.participants?.B?.accountId;}
function sameMatch(left,right){return validMarker(left)&&validMarker(right)&&left.matchId===right.matchId&&left.mode===right.mode&&left.participants.A.accountId===right.participants.A.accountId&&left.participants.B.accountId===right.participants.B.accountId;}

export function activeRankedMarker(state){const value=state?.[FIELD];return validMarker(value)?value:null;}
export function clearActiveRankedMarker(state,matchId){if(state?.[FIELD]?.matchId===matchId)delete state[FIELD];}

export class PvpRestartRecovery{
 constructor({loadState,persistPair,publishState=()=>{},withAccounts=async(_ids,work)=>work(),isMatchLive=()=>false,clock={now:()=>Date.now()}}){this.loadState=loadState;this.persistPair=persistPair;this.publishState=publishState;this.withAccounts=withAccounts;this.isMatchLive=isMatchLive;this.clock=clock;}
 async beginRanked(match,getState){
  const a=participant(match,'A'),b=participant(match,'B'),aState=getState(a.accountId),bState=getState(b.accountId);
  if(!aState||!bState)throw failure('PVP_RECOVERY_STATE_UNAVAILABLE');
  if(activeRankedMarker(aState)||activeRankedMarker(bState))throw failure('PVP_RECOVERY_MARKER_CONFLICT');
  const marker={version:1,kind:'ranked',matchId:match.id,mode:match.mode,createdAt:match.createdAt,participants:{A:a,B:b},catalogVersion:match.participants.A.catalogVersion||null,rulesVersion:match.participants.A.rulesVersion||null};
  const aNext=clone(aState),bNext=clone(bState);aNext[FIELD]=marker;bNext[FIELD]=marker;
  try{await this.persistPair([{userId:a.accountId,state:aNext},{userId:b.accountId,state:bNext}],`pvp:begin:${match.id}`);}
  catch(error){
   const [savedA,savedB]=await Promise.all([this.loadState(a.accountId),this.loadState(b.accountId)]),savedMarkerA=activeRankedMarker(savedA),savedMarkerB=activeRankedMarker(savedB);
   if(!sameMatch(savedMarkerA,savedMarkerB)||savedMarkerA.matchId!==match.id)throw error;
   this.publishState(a.accountId,savedA);this.publishState(b.accountId,savedB);return savedMarkerA;
  }
  this.publishState(a.accountId,aNext);this.publishState(b.accountId,bNext);return marker;
 }
 clearFromState(state,matchId){clearActiveRankedMarker(state,matchId);}
 async recoverForPlayer(accountId){
  const first=await this.loadState(accountId),hint=activeRankedMarker(first);if(first&&Object.hasOwn(first,FIELD)&&!hint)throw failure('PVP_RECOVERY_MARKER_CORRUPT');if(!hint||this.isMatchLive(hint.matchId))return first;
  const ids=[hint.participants.A.accountId,hint.participants.B.accountId];
  if(!ids.includes(accountId)||ids[0]===ids[1])throw failure('PVP_RECOVERY_MARKER_CORRUPT');
  return this.withAccounts(ids,async()=>{
   const [aState,bState]=await Promise.all(ids.map(id=>this.loadState(id))),aMarker=activeRankedMarker(aState),bMarker=activeRankedMarker(bState);if([aState,bState].some((state,index)=>state&&Object.hasOwn(state,FIELD)&&![aMarker,bMarker][index]))throw failure('PVP_RECOVERY_MARKER_CORRUPT');if(this.isMatchLive(hint.matchId))return accountId===ids[0]?aState:bState;
   if(!sameMatch(aMarker,bMarker))throw failure('PVP_RECOVERY_MARKER_CONFLICT','Active Ranked markers disagree; manual recovery required');
   const key=rankedSettlementKey({matchId:aMarker.matchId,mode:aMarker.mode,winner:null,accountA:ids[0],accountB:ids[1]}),proofA=rankedSettlementReceipt(aState,aMarker.matchId),proofB=rankedSettlementReceipt(bState,aMarker.matchId);
   if(proofA||proofB){if(!proofA||!proofB||proofA.key!==key||proofB.key!==key)throw failure('RANKED_SETTLEMENT_RECEIPT_CONFLICT');}
   const aNext=clone(aState),bNext=clone(bState),now=this.clock.now();clearActiveRankedMarker(aNext,aMarker.matchId);clearActiveRankedMarker(bNext,aMarker.matchId);
   if(!proofA){
    ensureRankedState(aNext);ensureRankedState(bNext);
    const pa=aMarker.participants.A,pb=aMarker.participants.B;
    recordRankedSettlement(aNext,{matchId:aMarker.matchId,key,outcome:'no-contest',reason:'server-restart-no-contest',mode:aMarker.mode,opponentName:pb.name,opponentRating:pb.rating,ratingDelta:0,ratingAfter:aNext.rankedV1.rating,rankTicketProtected:false,settledAt:now});
    recordRankedSettlement(bNext,{matchId:aMarker.matchId,key,outcome:'no-contest',reason:'server-restart-no-contest',mode:aMarker.mode,opponentName:pa.name,opponentRating:pa.rating,ratingDelta:0,ratingAfter:bNext.rankedV1.rating,rankTicketProtected:false,settledAt:now});
   }
   await this.persistPair([{userId:ids[0],state:aNext},{userId:ids[1],state:bNext}],`pvp:recover:${aMarker.matchId}`);
   this.publishState(ids[0],aNext);this.publishState(ids[1],bNext);return accountId===ids[0]?aNext:bNext;
  });
 }
}
