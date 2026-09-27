// Receipt and fingerprint stay private in the initiating trainer's save.
// No expiration until a durable archive can guarantee old action IDs stay spent.
import {createHash} from 'node:crypto';
import {findAppendOnlyBy} from './append-only-index.mjs';

export const validSocialActionId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const normalizeSocialText=value=>String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,500);
export function socialFingerprint(accountId,action){
 const type=action.type,recipient=type==='socialV1.friend.request'?String(action.friendCode||'').trim().toUpperCase().replaceAll('-',''):String(action.accountId||'');
 const payload={version:1,accountId,type,recipient,...(type==='socialV1.chat.send'?{text:normalizeSocialText(action.text)}:{})};
 return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}
export function inspectSocialReceipt(state,id,fingerprint){
 const receipt=findAppendOnlyBy(state?.socialActionReceiptsV1,'actionId',id);
 return !receipt?{status:'new'}:receipt.fingerprint===fingerprint?{status:'duplicate'}:{status:'conflict'};
}
export function appendSocialReceipt(state,{id,fingerprint,type,now}){
 if(!Array.isArray(state.socialActionReceiptsV1))state.socialActionReceiptsV1=[];
 const found=inspectSocialReceipt(state,id,fingerprint);if(found.status!=='new')return found;
 state.socialActionReceiptsV1.push({actionId:id,fingerprint,type,committedAt:now});return {status:'recorded'};
}
