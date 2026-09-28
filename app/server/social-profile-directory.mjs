// Narrow, bounded cache for public profile fields used by Social. Account saves,
// authentication identities and chat histories must never enter this cache.
const cleanName=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80):'';
const cleanAvatar=value=>typeof value==='string'&&value.length<=2048&&(/^(?:https:\/\/|\/[^/])/i).test(value)?value:null;

export class SocialProfileDirectory{
 constructor({clock,loadProfile,ttlMs=30_000,limit=256}){
  this.clock=clock;
  this.loadProfile=loadProfile;
  this.ttlMs=ttlMs;
  this.limit=limit;
  this.entries=new Map();
 }
 invalidate(accountId){this.entries.delete(accountId);}
 async get(accountId,fallback={}){
  const now=this.clock.now(),cached=this.entries.get(accountId);
  if(cached&&cached.expiresAt>now)return {...cached.profile,provider:fallback?.provider||null};
  this.entries.delete(accountId);
  const stored=await this.loadProfile(accountId);
  // Refuse a wrongly keyed profile rather than showing a different player's identity.
  if(stored?.userId!==undefined&&stored.userId!==accountId){
   throw Object.assign(new Error('Social profile lookup returned another account'),{code:'SOCIAL_PROFILE_MISMATCH'});
  }
  if(!stored)return {name:cleanName(fallback?.name)||'Vanguard Trainer',avatar:cleanAvatar(fallback?.avatar),provider:fallback?.provider||null};
  const profile={name:cleanName(stored.displayName)||'Vanguard Trainer',avatar:cleanAvatar(stored.avatarUrl)};
  if(this.ttlMs>0&&this.limit>0){
   this.entries.set(accountId,{profile,expiresAt:now+this.ttlMs});
   while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
  }
  return {...profile,provider:fallback?.provider||null};
 }
}
