// Ranked season/profile/rating domain; no match queues or storage operations.
import {rankedTier as tierName,rankedTierView} from './ranked-tiers.mjs';
import {recordMissionEvent} from './missions.mjs';
const clone=value=>structuredClone(value);
const SEASON_ID='2026-S1',RATING_VERSION='elo-v1-k32';
const finiteInt=(value,fallback=0)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback;
export const rankedTier=rating=>tierName(rating);
export function ensureRankedState(state){
 if(!state||typeof state!=='object')return false;let changed=false;if(!state.rankedV1||typeof state.rankedV1!=='object'){state.rankedV1={};changed=true;}
 const ranked=state.rankedV1,defaults={schemaVersion:1,seasonId:SEASON_ID,ratingVersion:RATING_VERSION,rating:1000,peakRating:1000,matches:0,wins:0,losses:0,draws:0,lastDelta:0,lastMatchAt:null,history:[]};
 for(const [key,value] of Object.entries(defaults))if(ranked[key]===undefined){ranked[key]=clone(value);changed=true;}
 if(ranked.seasonId!==SEASON_ID){ranked.seasonId=SEASON_ID;ranked.rating=1000;ranked.peakRating=Math.max(finiteInt(ranked.peakRating,1000),1000);ranked.matches=0;ranked.wins=0;ranked.losses=0;ranked.draws=0;ranked.lastDelta=0;ranked.history=[];changed=true;}
 ranked.rating=Math.max(0,finiteInt(ranked.rating,1000));ranked.peakRating=Math.max(ranked.rating,finiteInt(ranked.peakRating,ranked.rating));ranked.matches=Math.max(0,finiteInt(ranked.matches));ranked.wins=Math.max(0,finiteInt(ranked.wins));ranked.losses=Math.max(0,finiteInt(ranked.losses));ranked.draws=Math.max(0,finiteInt(ranked.draws));if(!Array.isArray(ranked.history)){ranked.history=[];changed=true;}return changed;
}
export function rankedProfileView(state){const holder={rankedV1:clone(state?.rankedV1)};ensureRankedState(holder);const ranked=holder.rankedV1;return {seasonId:ranked.seasonId,ratingVersion:ranked.ratingVersion,rating:ranked.rating,peakRating:ranked.peakRating,...rankedTierView(ranked.rating),matches:ranked.matches,wins:ranked.wins,losses:ranked.losses,draws:ranked.draws,lastDelta:ranked.lastDelta,lastMatchAt:ranked.lastMatchAt,history:clone(ranked.history.slice(0,10))};}
function expected(a,b){return 1/(1+10**((b-a)/400));}
export function rankedRatingDelta(ratingA,ratingB,scoreA,k=32){const delta=Math.round(k*(scoreA-expected(ratingA,ratingB)));return {A:delta,B:delta===0?0:-delta};}
export function settleProfile(state,{matchId,opponentName,opponentRating,score,delta,now,mode,protected:shielded=false}){ensureRankedState(state);const ranked=state.rankedV1;if(ranked.history.some(entry=>entry.matchId===matchId))return false;ranked.rating=Math.max(0,ranked.rating+delta);ranked.peakRating=Math.max(ranked.peakRating,ranked.rating);ranked.matches++;if(score===1)ranked.wins++;else if(score===0)ranked.losses++;else ranked.draws++;ranked.lastDelta=delta;ranked.lastMatchAt=now;ranked.history.unshift({matchId,mode,opponentName:String(opponentName||'Trainer').slice(0,80),opponentRating,result:score===1?'win':score===0?'loss':'draw',delta,...(shielded?{rankTicketProtected:true}:{}),ratingAfter:ranked.rating,playedAt:now});ranked.history=ranked.history.slice(0,20);recordMissionEvent(state,'battles',1,now);if(score===1)recordMissionEvent(state,'wins',1,now);return true;}
