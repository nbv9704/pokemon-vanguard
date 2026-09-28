// Queue compatibility and room creation are kept out of the service facade.
import {randomBytes,randomUUID} from 'node:crypto';
import {syncPvpDecisionClock} from './pvp-lifecycle.mjs';
const seed32=()=>randomBytes(4).readUInt32LE(0);
export function waitingWindow(ticket,now){return Math.min(700,250+Math.floor(Math.max(0,now-ticket.joinedAt)/15000)*50);}
function queueCompatible(a,b,now){return a.mode===b.mode&&a.regulationId===b.regulationId&&a.catalogVersion===b.catalogVersion&&a.rulesVersion===b.rulesVersion&&Math.abs(a.rating-b.rating)<=Math.max(waitingWindow(a,now),waitingWindow(b,now));}

export function tryRankedMatch(ticket){
const now=this.clock.now(),candidates=this.queue.filter(entry=>entry.accountId!==ticket.accountId&&queueCompatible(ticket,entry,now)).sort((a,b)=>Math.abs(a.rating-ticket.rating)-Math.abs(b.rating-ticket.rating)||a.joinedAt-b.joinedAt),opponent=candidates[0];if(!opponent)return null;this.queue=this.queue.filter(entry=>entry!==ticket&&entry!==opponent);const ordered=ticket.joinedAt<=opponent.joinedAt?[ticket,opponent]:[opponent,ticket],participant=entry=>({...entry,connected:this.presence.get(entry.accountId)?.connected!==false,lockedBuildIds:null,disconnectedAt:null,disconnectDeadlineAt:null,disconnectExpired:false}),match={id:`ranked-${randomUUID()}`,mode:ticket.mode,seed:seed32(),createdAt:now,updatedAt:now,lastActivityAt:now,participants:{A:participant(ordered[0]),B:participant(ordered[1])},battle:null,pending:{commands:{},replacements:{}},lastEvents:[],lastTurnRaw:null,actionReceipts:[],settled:false,ratingDelta:null,ratingAfter:null,dismissed:new Set(),decisionClock:null};syncPvpDecisionClock(match,now);this.matches.set(match.id,match);this.playerMatch.set(ordered[0].accountId,match.id);this.playerMatch.set(ordered[1].accountId,match.id);return match;
}
