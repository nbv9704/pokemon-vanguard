import {createHash} from 'node:crypto';
import {findAppendOnlyBy} from './append-only-index.mjs';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const validActionId=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);

export function prepareDurableAccountAction(state,action,namespace,{optional=false}={}){
 const base=structuredClone(state),actionId=action?.actionId;
 if(actionId===undefined&&optional)return {ok:true,base,legacy:true,fingerprint:null};
 if(!validActionId(actionId))return {ok:false,code:'ACTION_ID_REQUIRED'};
 const {actionId:_ignored,...payload}=action,fingerprint=`${namespace}:${createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')}`;
 base.actionReceipts=Array.isArray(base.actionReceipts)?base.actionReceipts:[];const prior=findAppendOnlyBy(base.actionReceipts,'actionId',actionId);
 if(prior&&prior.fingerprint!==fingerprint)return {ok:false,code:'ACTION_ID_REUSED'};
 if(prior)return {ok:true,base,duplicate:true,receipt:structuredClone(prior.result),fingerprint};
 return {ok:true,base,legacy:false,duplicate:false,fingerprint};
}

export function recordDurableAccountAction(state,action,namespace,fingerprint,result){
 const receipt={type:action.type,revision:state.revision||0,...structuredClone(result)};
 state.actionReceipts=Array.isArray(state.actionReceipts)?state.actionReceipts:[];
 state.actionReceipts.push({actionId:action.actionId,kind:action.type,fingerprint,receiptId:`${namespace}:${action.actionId}`,result:structuredClone(receipt)});
 return receipt;
}
