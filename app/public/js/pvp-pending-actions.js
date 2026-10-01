// Active PvP is intentionally session-scoped until roadmap item #18 is resumed.
// Keep one explicit intent per tab and never replay it automatically after reconnect.
const TYPES=new Set(['rankedV1.preview.lock','rankedV1.commands','rankedV1.replacements','rankedV1.surrender','rankedV1.dismiss','trainingPvpV1.preview.lock','trainingPvpV1.commands','trainingPvpV1.replacements','trainingPvpV1.surrender','trainingPvpV1.dismiss']);
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(id);
const validList=(value,limit=8)=>Array.isArray(value)&&value.length>0&&value.length<=limit;
const valid=action=>{
 if(!action||typeof action!=='object'||Array.isArray(action)||!TYPES.has(action.type)||!validId(action.actionId)||JSON.stringify(action).length>8192)return false;
 if(action.type.endsWith('.preview.lock'))return validList(action.buildIds,4)&&action.buildIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=128);
 if(action.type.endsWith('.commands'))return Number.isSafeInteger(action.phaseRevision)&&action.phaseRevision>=0&&validList(action.commands);
 if(action.type.endsWith('.replacements'))return Number.isSafeInteger(action.phaseRevision)&&action.phaseRevision>=0&&validList(action.replacements,4);
 return action.type.endsWith('.surrender')||action.type.endsWith('.dismiss');
};
export function pvpActionLabel(action){
 const mode=action?.type?.startsWith('rankedV1.')?'Ranked':'Friendly';
 if(action?.type?.endsWith('.preview.lock'))return `${mode} team selection`;
 if(action?.type?.endsWith('.commands'))return `${mode} turn command`;
 if(action?.type?.endsWith('.replacements'))return `${mode} replacement`;
 if(action?.type?.endsWith('.surrender'))return `${mode} surrender`;
 if(action?.type?.endsWith('.dismiss'))return `${mode} result dismissal`;
 return `${mode} action`;
}
export class PvpPendingActions{
 constructor({storage=null,scope}={}){
  this.storage=storage;this.key=`pv:pvp-pending:v1:${String(scope||'').slice(0,128)}`;this.current=null;this.lastError=null;this.persistent=!!storage;
  try{const data=JSON.parse(storage?.getItem(this.key)||'null');if(data?.version===1&&valid(data.action))this.current=data.action;}catch{this.persistent=false;}
 }
 get pending(){return this.current?structuredClone(this.current):null;}
 save(){try{if(this.current)this.storage?.setItem(this.key,JSON.stringify({version:1,action:this.current}));else this.storage?.removeItem(this.key);return !!this.storage;}catch{this.persistent=false;return false;}}
 begin(action){if(!valid(action)||this.current)return false;this.current=structuredClone(action);this.lastError=null;this.save();return true;}
 acknowledge(id,type){if(!this.current||id!==this.current.actionId||type!==this.current.type)return false;this.current=null;this.lastError=null;this.save();return true;}
 reject(id){if(!this.current||id!==this.current.actionId)return false;this.discard();return true;}
 discard(){this.current=null;this.lastError=null;this.save();}
 retry(sendAction){if(!this.current)return false;this.lastError=null;return !!sendAction(structuredClone(this.current));}
}
export function createPvpRetryController({outbox,sendAction,isBusy,isReady,notify=()=>{},onChange=()=>{}}){
 const canRetry=()=>isReady()&&!isBusy();
 const send=action=>{
  if(!isReady()||isBusy()){notify('Wait until the match connection is ready before submitting this action.');return false;}
  if(!outbox.begin(action)){notify('Resolve the unconfirmed PvP action first.');return false;}
  if(!outbox.persistent)notify('Session storage is blocked: keep this page open until the match server confirms the action.');
  const sent=sendAction(action);if(!sent){outbox.discard();onChange();}return sent;
 };
 const retry=()=>{if(!canRetry()){notify('Wait for the match to reconnect and sync.');return false;}const sent=outbox.retry(sendAction);onChange();return sent;};
 return {send,retry,canRetry};
}
