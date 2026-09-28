import {randomUUID} from "node:crypto";
import {validRankedActionId,rankedActionFingerprint} from './ranked-action-identity.mjs';
import {rankedSettlementReceipt,recentRankedSettlement} from './ranked-settlement-receipts.mjs';
import {ensureRankedState} from './ranked-profile.mjs';
import {tryRankedMatch} from './ranked-matchmaking.mjs';
import {rankedViewFor,rankedAdminOverview} from './ranked-view-projection.mjs';
import {startRankedBattleIfReady,finishRankedForfeit,finishRankedNoContest,applyRankedDecisionTimeout} from './ranked-match-transitions.mjs';
import {commitRankedSettlement} from './ranked-settlement-service.mjs';
export {rankedTier,ensureRankedState,rankedProfileView,rankedRatingDelta} from './ranked-profile.mjs';
import {replacementRequirements,validateReplacements} from '../rules-v3/index.mjs';
import {publicV3Preview} from './v3-battle-factory.mjs';
import {resolvePvpCommands,resolvePvpReplacements} from './pvp-battle-runtime.mjs';
import {normalizeCommands} from './v3-battle-actions.mjs';
import {validateV3Team} from './v3-progression.mjs';
import {PVP_TIMERS,markParticipantConnected,markParticipantDisconnected,markPvpActivity,participantDisconnectExpired,syncPvpDecisionClock} from './pvp-lifecycle.mjs';

const clone=value=>structuredClone(value),other=side=>side==='A'?'B':'A';
const replaceState=(target,source)=>{for(const key of Object.keys(target))delete target[key];Object.assign(target,source);};
function previewRoster(state,catalog,teamId){const progression=state.progressionV3,team=progression?.teams?.find(entry=>entry.teamId===(teamId||progression.activeTeamId||progression.teams[0]?.teamId));if(!team)return {ok:false,code:'TEAM_NOT_FOUND'};const problems=validateV3Team(team,progression,catalog);if(problems.length)return {ok:false,code:'TEAM_ILLEGAL',details:problems};return {ok:true,team,roster:publicV3Preview(team,progression,catalog)};}

export class RankedService{
 constructor({catalog,clock={now:()=>Date.now()},getState,loadState=null,persist=async()=>{},persistPair=null,publishState=null,notify=()=>{},withAccounts=async(_ids,work)=>work(),onSettlementFailure=()=>{}}){this.onSettlementFailure=onSettlementFailure;this.catalog=catalog;this.clock=clock;this.getState=getState;this.loadState=loadState;this.persist=persist;this.persistPair=persistPair;this.publishState=publishState;this.notify=notify;this.withAccounts=withAccounts;this.queue=[];this.matches=new Map();this.playerMatch=new Map();this.presence=new Map();}
 publish(accountId,next,current){if(this.publishState)this.publishState(accountId,next);else replaceState(current,next);}
 register(accountId,session){const now=this.clock.now(),current=this.presence.get(accountId)||{};this.presence.set(accountId,{...current,session,connected:true});const match=this.matches.get(this.playerMatch.get(accountId));if(match&&!match.settled){const side=this.sideFor(match,accountId);markParticipantConnected(match.participants[side],now);markPvpActivity(match,now);this.notify([match.participants[other(side)].accountId]);}}
 unregister(accountId){const now=this.clock.now(),current=this.presence.get(accountId);if(current)this.presence.set(accountId,{...current,connected:false});const index=this.queue.findIndex(entry=>entry.accountId===accountId);if(index>=0)this.queue.splice(index,1);const match=this.matches.get(this.playerMatch.get(accountId));if(match&&!match.settled){const side=this.sideFor(match,accountId);markParticipantDisconnected(match.participants[side],now);this.notify([match.participants[other(side)].accountId]);}}
 sideFor(match,accountId){return match.participants.A.accountId===accountId?'A':match.participants.B.accountId===accountId?'B':null;}
 busy(accountId){return this.queue.some(entry=>entry.accountId===accountId)||this.playerMatch.has(accountId);}
 viewFor(accountId,state){return rankedViewFor.call(this,accountId,state);}
 action(accountId,session,action){const match=this.matches.get(this.playerMatch.get(accountId)),ids=match?[match.participants.A.accountId,match.participants.B.accountId]:[accountId];return this.withAccounts(ids,()=>this.actionUnlocked(accountId,session,action));}
 async actionUnlocked(accountId,session,action){
  const state=this.getState(accountId);if(!state)return {ok:false,code:'ACCOUNT_STATE_UNAVAILABLE'};ensureRankedState(state);const now=this.clock.now(),type=action?.type;
  if(type==='rankedV1.dismiss'&&!this.playerMatch.has(accountId))return this.dismissRecent(accountId,state,now);
  if(type==='rankedV1.queue.join'){if(!['google','discord'].includes(session?.provider))return {ok:false,code:'RANKED_ACCOUNT_REQUIRED'};if(this.busy(accountId))return {ok:false,code:'RANKED_ALREADY_ACTIVE'};if(state.battleV3&&state.battleV3.phase!=='FINISHED')return {ok:false,code:'BATTLE_ALREADY_ACTIVE'};if(!['single','double'].includes(action.mode))return {ok:false,code:'INVALID_FORMAT'};const preview=previewRoster(state,this.catalog,action.teamId);if(!preview.ok)return preview;const ticket={ticketId:randomUUID(),accountId,mode:action.mode,joinedAt:now,rating:state.rankedV1.rating,teamId:preview.team.teamId,teamBuildIds:[...preview.team.buildIds],roster:preview.roster,name:session?.name||'Vanguard Trainer',regulationId:this.catalog.regulations[0].id,catalogVersion:this.catalog.metadata.catalogVersion,rulesVersion:this.catalog.metadata.rulesVersion};this.queue.push(ticket);const matched=this.tryMatch(ticket);this.notify(matched?[matched.participants.A.accountId,matched.participants.B.accountId]:[accountId]);return {ok:true};}
  if(type==='rankedV1.queue.leave'){const index=this.queue.findIndex(entry=>entry.accountId===accountId);if(index<0)return {ok:false,code:'NOT_IN_RANKED_QUEUE'};this.queue.splice(index,1);this.notify([accountId]);return {ok:true};}
  const match=this.matches.get(this.playerMatch.get(accountId));if(!match)return {ok:false,code:'NO_RANKED_MATCH'};const side=this.sideFor(match,accountId),participant=match.participants[side],revision=match.battle?.phaseRevision;if(participantDisconnectExpired(participant,now))return {ok:false,code:'DISCONNECT_TIMEOUT'};syncPvpDecisionClock(match,now);
  const actionId=action?.actionId;
  if(actionId!==undefined&&!validRankedActionId(actionId))return {ok:false,code:'INVALID_RANKED_ACTION_ID'};
  const receiptKey=actionId?`${accountId}:${actionId}`:null,fingerprint=actionId?rankedActionFingerprint(accountId,action):null;
  match.actionFingerprints??=new Map();
  if(receiptKey&&match.actionReceipts.includes(receiptKey)){
   const previous=match.actionFingerprints.get(receiptKey);
   if(previous&&previous!==fingerprint)return {ok:false,code:'RANKED_ACTION_ID_CONFLICT'};
   // A surrender may have completed the two-account write before its ACK was lost.
   // Never report it as complete without first restoring/finishing settlement.
   if(!match.settled&&(match.battle?.phase==='FINISHED'||match.forfeitReason))await this.settle(match);
   this.notify([accountId]);return {ok:true,duplicate:true};
  }
  if(type==='rankedV1.preview.lock'){if(match.battle||match.settled)return {ok:false,code:'WRONG_PHASE'};const p=participant,pick=this.catalog.regulations[0].pick[match.mode];if(!Array.isArray(action.buildIds)||action.buildIds.length!==pick||new Set(action.buildIds).size!==pick||action.buildIds.some(id=>!p.teamBuildIds.includes(id)))return {ok:false,code:'INVALID_PREVIEW_SELECTION'};p.lockedBuildIds=[...action.buildIds];this.startBattleIfReady(match);}
  else if(type==='rankedV1.commands'){if(match.settled||match.battle?.phase!=='COMMAND'||action.phaseRevision!==revision)return {ok:false,code:'STALE_PHASE'};const validated=normalizeCommands(match.battle,side,action.commands,this.catalog);if(!validated.ok)return validated;match.pending.commands[revision]??={};match.pending.commands[revision][side]=clone(action.commands);const resolved=resolvePvpCommands(match,this.catalog);if(!resolved.ok)return resolved;}
  else if(type==='rankedV1.replacements'){if(match.settled||match.battle?.phase!=='REPLACE'||action.phaseRevision!==revision)return {ok:false,code:'STALE_PHASE'};const required=replacementRequirements(match.battle,side);if(!required.slots.length)return {ok:false,code:'NO_REPLACEMENT_REQUIRED'};const validated=validateReplacements(match.battle,side,action.replacements);if(!validated.ok)return validated;match.pending.replacements[revision]??={};match.pending.replacements[revision][side]=clone(action.replacements);const resolved=resolvePvpReplacements(match,this.catalog);if(!resolved.ok)return resolved;}
  else if(type==='rankedV1.surrender'){if(match.settled)return {ok:false,code:'WRONG_PHASE'};
   if(match.battle?.phase==='FINISHED'||match.forfeitReason)return {ok:false,code:'SETTLEMENT_PENDING'};
   // Capture intent before async persist, so a lost response can retry this ID.
   if(receiptKey){match.actionReceipts.push(receiptKey);match.actionFingerprints.set(receiptKey,fingerprint);}
   await this.finishForfeit(match,side,match.battle?'surrender':'preview-forfeit');}
  else if(type==='rankedV1.dismiss'){if(!match.settled)return {ok:false,code:'MATCH_NOT_FINISHED'};await this.dismissRecent(accountId,state,now,match.id);this.playerMatch.delete(accountId);match.dismissed.add(accountId);if(match.dismissed.size===2)this.matches.delete(match.id);this.notify([accountId]);return {ok:true};}
  else return {ok:false,code:'UNKNOWN_RANKED_ACTION'};
  markPvpActivity(match,now);syncPvpDecisionClock(match,now);if(receiptKey&&!match.actionReceipts.includes(receiptKey)){match.actionReceipts.push(receiptKey);match.actionFingerprints.set(receiptKey,fingerprint);}match.actionReceipts=match.actionReceipts.slice(-200);for(const key of match.actionFingerprints.keys())if(!match.actionReceipts.includes(key))match.actionFingerprints.delete(key);if(match.battle?.phase==='FINISHED'&&!match.settled)await this.settle(match);this.notify([match.participants.A.accountId,match.participants.B.accountId]);return {ok:true};
 }
 async dismissRecent(accountId,state,now,matchId=null){
  const durable=this.loadState?await this.loadState(accountId):null,base=durable||state;
  const receipt=matchId?rankedSettlementReceipt(base,matchId):recentRankedSettlement(base,now,PVP_TIMERS.resultRetentionMs);
  if(!receipt)return matchId?{ok:true}:{ok:false,code:'MATCH_NOT_FINISHED'};
  if(receipt.dismissedAt){if(durable)this.publish(accountId,durable,state);return {ok:true,duplicate:true};}
  const next=clone(base),entry=rankedSettlementReceipt(next,receipt.matchId);entry.dismissedAt=now;
  await this.persist(accountId,next);this.publish(accountId,next,state);this.notify([accountId]);return {ok:true};
 }
 startBattleIfReady(match){return startRankedBattleIfReady.call(this,match);}
 adminOverview(){return rankedAdminOverview.call(this);}
 adminStopForPlayer(accountId,reason='admin-stop'){const match=this.matches.get(this.playerMatch.get(accountId)),ids=match?[match.participants.A.accountId,match.participants.B.accountId]:[accountId];return this.withAccounts(ids,()=>this.adminStopUnlocked(accountId,reason));}
 async adminStopUnlocked(accountId,reason){const queueIndex=this.queue.findIndex(entry=>entry.accountId===accountId);if(queueIndex>=0){const [ticket]=this.queue.splice(queueIndex,1);this.notify([accountId]);return {ok:true,kind:'ranked-queue',id:ticket.ticketId,accounts:[accountId]};}const match=this.matches.get(this.playerMatch.get(accountId));if(!match||match.settled)return {ok:false,code:'NO_RANKED_ACTIVITY'};await this.finishNoContest(match,reason);const accounts=[match.participants.A.accountId,match.participants.B.accountId];this.notify(accounts);return {ok:true,kind:'ranked-match',id:match.id,accounts};}
 tryMatch(ticket){return tryRankedMatch.call(this,ticket);}
 async finishForfeit(match,loserSide,reason){return finishRankedForfeit.call(this,match,loserSide,reason);}
 async finishNoContest(match,reason){return finishRankedNoContest.call(this,match,reason);}
 async settle(match){if(match.settled)return;if(match.settlementPromise)return match.settlementPromise;
  match.settlementPendingAt??=this.clock.now();match.settlementRetries??=0;
  const pending=this.commitSettlement(match);match.settlementPromise=pending;
  try{const result=await pending;match.settlementPendingAt=null;return result;}
  catch(error){match.settlementRetries++;this.onSettlementFailure({errorCode:error?.code,retryCount:match.settlementRetries});throw error;}
  finally{match.settlementPromise=null;}
 }
 async commitSettlement(match){return commitRankedSettlement.call(this,match);}
 cleanupMatch(match){for(const p of [match.participants.A,match.participants.B])if(this.playerMatch.get(p.accountId)===match.id)this.playerMatch.delete(p.accountId);this.matches.delete(match.id);}
 async applyDecisionTimeout(match,now){return applyRankedDecisionTimeout.call(this,match,now);}
 async tick(){const now=this.clock.now();for(const match of [...this.matches.values()])await this.withAccounts([match.participants.A.accountId,match.participants.B.accountId],()=>this.tickMatch(match,now));}
 async tickMatch(match,now){if(match.settled){if(now-(match.settledAt||now)>=PVP_TIMERS.resultRetentionMs){const accounts=[match.participants.A.accountId,match.participants.B.accountId];this.cleanupMatch(match);this.notify(accounts);}return;}
  // A previous commit may have succeeded before the network response failed.
  // Retry with the durable pair receipt rather than running timeout policies.
  if(match.battle?.phase==='FINISHED'||match.forfeitReason){await this.settle(match);this.notify([match.participants.A.accountId,match.participants.B.accountId]);return;}
  const expired=['A','B'].filter(side=>participantDisconnectExpired(match.participants[side],now));if(expired.length===2){await this.finishNoContest(match,'both-disconnected');this.notify([match.participants.A.accountId,match.participants.B.accountId]);return;}if(expired.length===1){const foe=match.participants[other(expired[0])];if(foe.connected!==false){await this.finishForfeit(match,expired[0],'disconnect-timeout');this.notify([match.participants.A.accountId,match.participants.B.accountId]);return;}}
  if(now-(match.lastActivityAt||match.createdAt)>=PVP_TIMERS.hardIdleMs){await this.finishNoContest(match,'match-expired');this.notify([match.participants.A.accountId,match.participants.B.accountId]);return;}await this.applyDecisionTimeout(match,now);}
}
