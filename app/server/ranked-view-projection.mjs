// Read-only Ranked state projection; server and browser clients use the same service facade.
import {rankedProfileView} from './ranked-profile.mjs';
import {rankedTierView} from './ranked-tiers.mjs';
import {waitingWindow} from './ranked-matchmaking.mjs';
import {recentRankedSettlement} from './ranked-settlement-receipts.mjs';
import {pvpBattleView} from './pvp-battle-runtime.mjs';
import {PVP_TIMERS,pvpTimingView} from './pvp-lifecycle.mjs';
const clone=value=>structuredClone(value),other=side=>side==='A'?'B':'A';
function participantView(participant){return {name:participant.name,rating:participant.rating,...rankedTierView(participant.rating),connected:participant.connected!==false,reconnectDeadlineAt:participant.connected===false?participant.disconnectDeadlineAt||null:null};}
export function rankedViewFor(accountId,state){
  const profile=rankedProfileView(state),session=this.presence.get(accountId)?.session,eligible=['google','discord'].includes(session?.provider),match=this.matches.get(this.playerMatch.get(accountId)),now=this.clock.now();
  if(match){const side=this.sideFor(match,accountId),foe=match.participants[other(side)],won=match.settled?(match.battle?.result?.winner||match.forfeitWinner||null):null,battleV3=pvpBattleView(match,side,{kind:'ranked',difficulty:'ranked',participantView,rating:true});if(battleV3)battleV3.timing=pvpTimingView(match,side,now);return {schemaVersion:1,status:match.settled?'finished':match.battle?'battle':'preview',eligible,profile,match:{id:match.id,mode:match.mode,createdAt:match.createdAt,opponent:participantView(foe)},battleV3,...(match.settled?{result:{outcome:won===side?'win':won?'loss':'draw',reason:match.battle?.result?.reason||match.forfeitReason||'completed',ratingDelta:match.ratingDelta?.[side]??0,ratingAfter:match.ratingAfter?.[side]??profile.rating,rankTicketProtected:!!match.rankTicketProtected?.[side]}}:{})};}
  const ticket=this.queue.find(entry=>entry.accountId===accountId);if(ticket)return {schemaVersion:1,status:'queued',eligible,profile,queue:{ticketId:ticket.ticketId,mode:ticket.mode,joinedAt:ticket.joinedAt,position:this.queue.filter(entry=>entry.mode===ticket.mode).indexOf(ticket)+1,ratingWindow:waitingWindow(ticket,now)}};
  const recent=this.loadState?recentRankedSettlement(state,now,PVP_TIMERS.resultRetentionMs):null;
  if(recent)return {schemaVersion:1,status:'finished',eligible,profile,match:{id:recent.matchId,mode:recent.mode,createdAt:recent.settledAt,opponent:{name:recent.opponentName,rating:recent.opponentRating}},battleV3:null,result:clone(recent.result),recovered:true};
  return {schemaVersion:1,status:'idle',eligible,profile};
 }

export function rankedAdminOverview(){const queue=this.queue.map(entry=>({kind:'ranked-queue',id:entry.ticketId,accountId:entry.accountId,name:entry.name,mode:entry.mode,rating:entry.rating,joinedAt:entry.joinedAt})),matches=[...this.matches.values()].filter(match=>!match.settled).map(match=>({kind:'ranked-match',id:match.id,mode:match.mode,status:match.battle?match.battle.phase:'PREVIEW',createdAt:match.createdAt,decisionDeadlineAt:match.decisionClock?.deadlineAt||null,players:[match.participants.A,match.participants.B].map(p=>({accountId:p.accountId,name:p.name,rating:p.rating,connected:p.connected!==false,reconnectDeadlineAt:p.disconnectDeadlineAt||null}))}));return {queue,matches};}
