const HOUR=60*60*1000,DAY=24*HOUR;
const clone=value=>structuredClone(value);
const finiteTime=(value,fallback)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback;
const boundedMs=(value,fallback)=>Math.min(365*DAY,Math.max(HOUR,finiteTime(value,fallback)));

export const MAIL_RETENTION_PRESETS=Object.freeze({
 standard:Object.freeze({id:'standard',label:'Standard Gift',unreadTtlMs:14*DAY,readTtlMs:3*DAY}),
 event:Object.freeze({id:'event',label:'Event Gift',unreadTtlMs:7*DAY,readTtlMs:2*DAY}),
 compensation:Object.freeze({id:'compensation',label:'Compensation',unreadTtlMs:30*DAY,readTtlMs:7*DAY})
});

export const SYSTEM_MAIL_DEFINITIONS=Object.freeze([
 Object.freeze({mailId:0,key:'welcome-gift',type:'welcome',sender:'Vanguard League Operations',title:'Welcome Gift',message:'Thank you for joining the beta. Please accept these supplies for your adventure.',unreadTtlMs:90*DAY,readTtlMs:14*DAY}),
 Object.freeze({mailId:1,key:'training-update-gift',type:'update',sender:'Vanguard Training Center',title:'Training Room Update Gift',message:'Pokémon Training and Replica Teams are now available. These supplies will help you test the new systems.',unreadTtlMs:30*DAY,readTtlMs:7*DAY}),
 Object.freeze({mailId:2,key:'mission-board-gift',type:'update',sender:'League Mission Office',title:'Mission Board Opening Gift',message:'The Mission Board is open. Here is a small launch gift from the League staff.',unreadTtlMs:30*DAY,readTtlMs:7*DAY})
]);
const SYSTEM_BY_ID=new Map(SYSTEM_MAIL_DEFINITIONS.map(entry=>[entry.mailId,entry]));

export function mailExpiry({sentAt,readAt=null,unreadTtlMs,readTtlMs}){
 const sent=finiteTime(sentAt,Date.now()),unreadExpiry=sent+boundedMs(unreadTtlMs,14*DAY);
 if(readAt===null||readAt===undefined||!Number.isFinite(Number(readAt)))return {unreadExpiresAt:unreadExpiry,expiresAt:unreadExpiry};
 const readExpiry=finiteTime(readAt,sent)+boundedMs(readTtlMs,3*DAY);
 return {unreadExpiresAt:unreadExpiry,expiresAt:Math.min(unreadExpiry,readExpiry)};
}
export function isMailExpired(entry,now=Date.now()){return now>=mailExpiry(entry).expiresAt;}

export function normalizeAdminMailLifecycle(gift){
 const type=MAIL_RETENTION_PRESETS[gift?.mailType]||MAIL_RETENTION_PRESETS.standard,presetId=type.id;
 gift.mailType=presetId;gift.unreadTtlMs=boundedMs(gift.unreadTtlMs,type.unreadTtlMs);gift.readTtlMs=boundedMs(gift.readTtlMs,type.readTtlMs);
 if(gift.readAt===null||gift.readAt===undefined||!Number.isFinite(Number(gift.readAt)))gift.readAt=null;
 return gift;
}

export function ensureMailboxState(state,{now=Date.now()}={}){
 if(!state.mailboxV1||typeof state.mailboxV1!=='object')state.mailboxV1={version:1,system:{}};
 state.mailboxV1.version=1;if(!state.mailboxV1.system||typeof state.mailboxV1.system!=='object')state.mailboxV1.system={};
 const claimed=new Set([...(Array.isArray(state.mailClaims)?state.mailClaims:[]),...(Array.isArray(state.mail)?state.mail:[])]);
 for(const definition of SYSTEM_MAIL_DEFINITIONS){
  const key=String(definition.mailId),current=state.mailboxV1.system[key];
  if(!current||typeof current!=='object')state.mailboxV1.system[key]={receivedAt:now,readAt:claimed.has(definition.mailId)?now:null,claimedAt:claimed.has(definition.mailId)?now:null};
  else{
   current.receivedAt=finiteTime(current.receivedAt,now);if(current.readAt===null||current.readAt===undefined||!Number.isFinite(Number(current.readAt)))current.readAt=null;if(current.claimedAt===null||current.claimedAt===undefined||!Number.isFinite(Number(current.claimedAt)))current.claimedAt=null;
   if(claimed.has(definition.mailId)){if(current.readAt===null)current.readAt=now;if(current.claimedAt===null)current.claimedAt=now;}
  }
 }
 if(state.adminGiftsV1?.inbox)for(const gift of state.adminGiftsV1.inbox)normalizeAdminMailLifecycle(gift);
 return state.mailboxV1;
}

export function systemMailLifecycle(state,mailId,{now=Date.now()}={}){
 const definition=SYSTEM_BY_ID.get(Number(mailId));if(!definition)return null;const mailbox=ensureMailboxState(state,{now}),record=mailbox.system[String(definition.mailId)];
 const lifecycle={sentAt:record.receivedAt,readAt:record.readAt,unreadTtlMs:definition.unreadTtlMs,readTtlMs:definition.readTtlMs},expiry=mailExpiry(lifecycle);
 return {definition,record,...lifecycle,...expiry,expired:now>=expiry.expiresAt};
}

export function systemMailboxView(state,catalog,{now=Date.now()}={}){
 ensureMailboxState(state,{now});const mails=[];
 for(const definition of SYSTEM_MAIL_DEFINITIONS){
  const lifecycle=systemMailLifecycle(state,definition.mailId,{now});if(!lifecycle||lifecycle.expired)continue;
  const reward=catalog.economy.mail.find(entry=>entry.mailId===definition.mailId)?.reward||{};
  mails.push({id:`system:${definition.mailId}`,kind:'system',mailId:definition.mailId,type:definition.type,sender:definition.sender,title:definition.title,message:definition.message,sentAt:lifecycle.sentAt,readAt:lifecycle.readAt,unread:lifecycle.readAt===null,claimedAt:lifecycle.record.claimedAt,claimable:lifecycle.record.claimedAt===null,unreadExpiresAt:lifecycle.unreadExpiresAt,expiresAt:lifecycle.expiresAt,readTtlMs:definition.readTtlMs,reward:clone(reward)});
 }
 return {version:1,unreadCount:mails.filter(mail=>mail.unread).length,pendingCount:mails.filter(mail=>mail.claimable).length,mails};
}

export const isMailboxAction=action=>action?.type==='mailboxV1.read';
export function applyMailboxAction(state,action,{now=Date.now()}={}){
 if(!isMailboxAction(action))return {ok:false,code:'UNKNOWN_MAILBOX_ACTION'};const base=clone(state);ensureMailboxState(base,{now});let changed=false;
 if(action.kind==='system'){
  const lifecycle=systemMailLifecycle(base,action.mailId,{now});if(!lifecycle)return {ok:false,code:'MAIL_NOT_FOUND'};if(lifecycle.expired)return {ok:false,code:'MAIL_EXPIRED'};
  if(lifecycle.record.readAt===null){lifecycle.record.readAt=now;changed=true;}
 }else if(action.kind==='admin'){
  const gift=base.adminGiftsV1?.inbox?.find(entry=>entry.giftId===String(action.giftId||''));if(!gift)return {ok:false,code:'GIFT_NOT_FOUND'};normalizeAdminMailLifecycle(gift);if(isMailExpired({sentAt:gift.sentAt,readAt:gift.readAt,unreadTtlMs:gift.unreadTtlMs,readTtlMs:gift.readTtlMs},now))return {ok:false,code:'GIFT_EXPIRED'};
  if(gift.readAt===null){gift.readAt=now;changed=true;}
 }else return {ok:false,code:'MAIL_KIND_INVALID'};
 if(changed)base.revision=(base.revision||0)+1;return {ok:true,state:base,changed};
}

export function markSystemMailClaimed(state,mailId,now=Date.now()){
 const lifecycle=systemMailLifecycle(state,mailId,{now});if(!lifecycle)return {ok:false,code:'MAIL_NOT_FOUND'};if(lifecycle.expired)return {ok:false,code:'MAIL_EXPIRED'};
 if(lifecycle.record.readAt===null)lifecycle.record.readAt=now;lifecycle.record.claimedAt=now;return {ok:true};
}

export const mailboxDurationDays=ms=>Math.round((Number(ms)||0)/DAY*100)/100;
