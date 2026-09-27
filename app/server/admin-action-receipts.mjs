// Persistent Admin action identity. Receipts live in the same player save as the
// mutation: a lost HTTP response cannot turn a retry into a second mutation.
import {createHash} from 'node:crypto';

export const validAdminActionId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):value!==null&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function adminActionFingerprint(adminId,userId,action){
 const {actionId:_ignored,...payload}=action;
 return createHash('sha256').update(JSON.stringify(canonical({version:1,adminId,userId,action:payload}))).digest('hex');
}
export function lookupAdminActionReceipt(state,actionId,fingerprint){
 const receipt=(state.adminActionReceiptsV1||[]).find(entry=>entry.actionId===actionId);
 return !receipt?{status:'new'}:receipt.fingerprint===fingerprint?{status:'duplicate',receipt}:{status:'conflict',receipt};
}
export function appendAdminActionReceipt(state,{actionId,fingerprint,adminId,type,committedAt}){
 if(!Array.isArray(state.adminActionReceiptsV1))state.adminActionReceiptsV1=[];
 // Never truncate this list until receipts have been archived into another
 // durable dedupe store. Pruning would allow old IDs to execute again.
 const existing=lookupAdminActionReceipt(state,actionId,fingerprint);
 if(existing.status!=='new')return existing;
 state.adminActionReceiptsV1.push({actionId,fingerprint,adminId,type,committedAt});
 return {status:'recorded'};
}
