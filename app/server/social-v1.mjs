import {randomUUID,createHash} from 'node:crypto';
import {validSocialActionId,socialFingerprint,inspectSocialReceipt,appendSocialReceipt,normalizeSocialText} from './social-action-receipts.mjs';
import {SocialProfileDirectory} from './social-profile-directory.mjs';
const clone=value=>structuredClone(value),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const trimName=value=>String(value||'Vanguard Trainer').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,80)||'Vanguard Trainer';
export function friendCodeFor(accountId){if(!UUID.test(accountId||''))return null;const hex=accountId.replaceAll('-','').toUpperCase();return `PV-${hex.slice(0,8)}-${hex.slice(8,16)}-${hex.slice(16,24)}-${hex.slice(24)}`;}
export function accountIdFromFriendCode(code){const hex=String(code||'').trim().toUpperCase().replace(/^PV-/,'').replaceAll('-','');if(!/^[0-9A-F]{32}$/.test(hex))return null;const lower=hex.toLowerCase(),uuid=`${lower.slice(0,8)}-${lower.slice(8,12)}-${lower.slice(12,16)}-${lower.slice(16,20)}-${lower.slice(20)}`;return UUID.test(uuid)?uuid:null;}
export function ensureSocialState(state){if(!state.socialV1||typeof state.socialV1!=='object')state.socialV1={};const s=state.socialV1;s.schemaVersion=1;if(!Array.isArray(s.friends))s.friends=[];if(!Array.isArray(s.incomingRequests))s.incomingRequests=[];if(!Array.isArray(s.outgoingRequests))s.outgoingRequests=[];if(!s.conversations||typeof s.conversations!=='object'||Array.isArray(s.conversations))s.conversations={};return s;}
const friendOf=(state,id)=>ensureSocialState(state).friends.find(entry=>entry.accountId===id);
export class SocialService{
 constructor({clock={now:()=>Date.now()},getState=()=>null,loadState=async()=>null,loadProfile=async()=>null,persistPair=null,setLiveState=()=>{},notify=()=>{},withAccounts=async(_ids,work)=>work(),profileTtlMs=30_000,profileCacheLimit=256}={}){this.clock=clock;this.getState=getState;this.loadState=loadState;this.persistPair=persistPair;this.setLiveState=setLiveState;this.notify=notify;this.withAccounts=withAccounts;this.presence=new Map();this.lastMessageAt=new Map();this.directory=new SocialProfileDirectory({clock,loadProfile,ttlMs:profileTtlMs,limit:profileCacheLimit});}
 register(accountId,session){this.directory.invalidate(accountId);this.presence.set(accountId,{session,connected:true});}
 unregister(accountId){this.presence.delete(accountId);this.directory.invalidate(accountId);}
 isFriend(a,b){const state=this.getState(a);return !!state&&!!friendOf(state,b);}
 async stateFor(id){return await this.loadState(id)||this.getState(id)||null;}
 viewFor(accountId,state){const holder=clone(state),social=ensureSocialState(holder),online=id=>this.presence.get(id)?.connected===true;return {schemaVersion:1,eligible:UUID.test(accountId||''),friendCode:friendCodeFor(accountId),friends:social.friends.map(entry=>({...clone(entry),online:online(entry.accountId)})),incomingRequests:clone(social.incomingRequests),outgoingRequests:clone(social.outgoingRequests),conversations:Object.fromEntries(Object.entries(social.conversations).map(([id,list])=>[id,clone((list||[]).slice(-100))]))};}
 async profile(accountId,fallback={},authenticated=false){const session=authenticated?fallback:(this.presence.get(accountId)?.connected?this.presence.get(accountId).session:null);const details=session?{name:trimName(session.name),avatar:session.avatar||null,provider:session.provider||null}:await this.directory.get(accountId,fallback);return {accountId,...details};}
 async savePair(aId,aState,bId,bState,operationId){if(typeof this.persistPair!=='function')throw Object.assign(new Error('Atomic Social pair storage is required'),{code:'SOCIAL_ATOMIC_STORAGE_REQUIRED'});await this.persistPair([{userId:aId,state:aState},{userId:bId,state:bState}],operationId);this.setLiveState(aId,aState);this.setLiveState(bId,bState);this.notify([aId,bId]);}
 action(accountId,session,action){const targetId=action?.type==='socialV1.friend.request'?accountIdFromFriendCode(action.friendCode):String(action?.accountId||'');return this.withAccounts([accountId,UUID.test(targetId)?targetId:null],()=>this.actionUnlocked(accountId,session,action));}
 async actionUnlocked(accountId,session,action){if(!UUID.test(accountId||'')||!['google','discord'].includes(session?.provider))return {ok:false,code:'ACCOUNT_REQUIRED'};let current=await this.stateFor(accountId);if(!current)return {ok:false,code:'ACCOUNT_STATE_UNAVAILABLE'};const type=action?.type,now=this.clock.now();
  const actionId=action?.actionId;
  if(actionId!==undefined&&!validSocialActionId(actionId))return {ok:false,code:'INVALID_SOCIAL_ACTION_ID'};
  const fingerprint=actionId?socialFingerprint(accountId,action):null;
  if(actionId){
   // When the pair was committed but publish/ACK failed, the in-memory room can
   // still be stale. Check durable initiating account before any precondition.
   const stored=await this.loadState(accountId);
   for(const candidate of [stored,current]){
    const result=inspectSocialReceipt(candidate,actionId,fingerprint);
    if(result.status==='conflict')return {ok:false,code:'SOCIAL_ACTION_ID_CONFLICT'};
    if(result.status==='duplicate'){
     if(stored&&inspectSocialReceipt(stored,actionId,fingerprint).status==='duplicate'){
      this.setLiveState(accountId,stored);
      const otherId=type==='socialV1.friend.request'?accountIdFromFriendCode(action.friendCode):String(action.accountId||'');
      if(UUID.test(otherId)&&otherId!==accountId){const otherSaved=await this.loadState(otherId);if(otherSaved)this.setLiveState(otherId,otherSaved);}
      this.notify([accountId,...(UUID.test(otherId)?[otherId]:[])]);
     }
     return {ok:true,duplicate:true};
    }
   }
   // Do not write over a newer durable state after a failed live publication.
   if(stored)current=stored;
  }
  const state=clone(current),social=ensureSocialState(state);
  const operationId=`social:${accountId}:${actionId?createHash('sha256').update(actionId).digest('hex'):randomUUID()}`;
  const commit=async(targetId,targetState)=>{
   if(actionId)appendSocialReceipt(state,{id:actionId,fingerprint,type,now});
   await this.savePair(accountId,state,targetId,targetState,operationId);
   return {ok:true};
  };
  if(type==='socialV1.friend.request'){const targetId=accountIdFromFriendCode(action.friendCode);if(!targetId)return {ok:false,code:'INVALID_FRIEND_CODE'};if(targetId===accountId)return {ok:false,code:'CANNOT_ADD_SELF'};if(friendOf(state,targetId))return {ok:false,code:'ALREADY_FRIENDS'};if(social.outgoingRequests.some(entry=>entry.accountId===targetId))return {ok:false,code:'REQUEST_ALREADY_SENT'};if(social.friends.length>=100||social.outgoingRequests.length>=100)return {ok:false,code:'SOCIAL_LIMIT_REACHED'};const targetCurrent=await this.stateFor(targetId);if(!targetCurrent)return {ok:false,code:'TRAINER_NOT_FOUND'};const target=clone(targetCurrent),targetSocial=ensureSocialState(target);if(targetSocial.outgoingRequests.some(entry=>entry.accountId===accountId))return {ok:false,code:'REQUEST_ALREADY_RECEIVED'};if(targetSocial.incomingRequests.some(entry=>entry.accountId===accountId))return {ok:false,code:'REQUEST_ALREADY_SENT'};if(targetSocial.friends.length>=100||targetSocial.incomingRequests.length>=100)return {ok:false,code:'SOCIAL_LIMIT_REACHED'};const me=await this.profile(accountId,session,true),them=await this.profile(targetId);social.outgoingRequests.push({...them,requestedAt:now});targetSocial.incomingRequests.push({...me,requestedAt:now});return commit(targetId,target);}
  const targetId=String(action.accountId||'');if(!UUID.test(targetId))return {ok:false,code:'INVALID_TRAINER'};const targetCurrent=await this.stateFor(targetId);if(!targetCurrent)return {ok:false,code:'TRAINER_NOT_FOUND'};const target=clone(targetCurrent),targetSocial=ensureSocialState(target);
  if(type==='socialV1.friend.accept'){const request=social.incomingRequests.find(entry=>entry.accountId===targetId),outgoing=targetSocial.outgoingRequests.some(entry=>entry.accountId===accountId);if(!request&&friendOf(state,targetId)&&friendOf(target,accountId))return {ok:true,duplicate:true};if(!request)return {ok:false,code:'REQUEST_NOT_FOUND'};if(!outgoing)return {ok:false,code:'REQUEST_NOT_MUTUAL'};if((!friendOf(state,targetId)&&social.friends.length>=100)||(!friendOf(target,accountId)&&targetSocial.friends.length>=100))return {ok:false,code:'SOCIAL_LIMIT_REACHED'};const me=await this.profile(accountId,session,true),them=await this.profile(targetId,request);social.incomingRequests=social.incomingRequests.filter(entry=>entry.accountId!==targetId);targetSocial.outgoingRequests=targetSocial.outgoingRequests.filter(entry=>entry.accountId!==accountId);if(!friendOf(state,targetId))social.friends.push({...them,since:now});if(!friendOf(target,accountId))targetSocial.friends.push({...me,since:now});return commit(targetId,target);}
  if(type==='socialV1.friend.reject'){social.incomingRequests=social.incomingRequests.filter(entry=>entry.accountId!==targetId);targetSocial.outgoingRequests=targetSocial.outgoingRequests.filter(entry=>entry.accountId!==accountId);return commit(targetId,target);}
  if(type==='socialV1.friend.cancel'){social.outgoingRequests=social.outgoingRequests.filter(entry=>entry.accountId!==targetId);targetSocial.incomingRequests=targetSocial.incomingRequests.filter(entry=>entry.accountId!==accountId);return commit(targetId,target);}
  if(type==='socialV1.friend.remove'){social.friends=social.friends.filter(entry=>entry.accountId!==targetId);targetSocial.friends=targetSocial.friends.filter(entry=>entry.accountId!==accountId);delete social.conversations[targetId];delete targetSocial.conversations[accountId];return commit(targetId,target);}
  if(type==='socialV1.chat.send'){if(!friendOf(state,targetId)||!friendOf(target,accountId))return {ok:false,code:'FRIEND_REQUIRED'};const last=this.lastMessageAt.get(accountId)||0;if(now-last<750)return {ok:false,code:'CHAT_RATE_LIMITED'};const text=normalizeSocialText(action.text);if(!text)return {ok:false,code:'EMPTY_MESSAGE'};const message={id:randomUUID(),fromAccountId:accountId,toAccountId:targetId,text,sentAt:now};for(const [,s,id] of [[accountId,social,targetId],[targetId,targetSocial,accountId]]){s.conversations[id]??=[];s.conversations[id].push(message);s.conversations[id]=s.conversations[id].slice(-100);}const result=await commit(targetId,target);this.lastMessageAt.set(accountId,now);return result;}
  return {ok:false,code:'UNKNOWN_SOCIAL_ACTION'};
 }
}
