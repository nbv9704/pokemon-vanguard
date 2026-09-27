// Money/ticket actions require a durable server receipt before clearing pending.
// Retain exactly one intent in the current tab and never replay it automatically.
const TYPES=new Set(['shopV3.buy','recruitV3.refresh','recruitV3.trial','recruitV3.permanent','battleV3.preview.start','battleV3.preview.lock','battleV3.commands','battleV3.replacements','battleV3.surrender','battleV3.dismiss','battleV2.preview.start','battleV2.preview.lock','battleV2.commands','battleV2.replacements','battleV2.surrender','mission.claim','mission.claimAll','adminGift.claim','bagV1.rankProtection','build.save','team.save','blueprint.import']);
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(id);
const battlePayloadValid=a=>{
 if(!a.type.startsWith('battleV3.')&&!a.type.startsWith('battleV2.'))return true;const version=a.type.startsWith('battleV3.')?'battleV3':'battleV2';
 if(a.type===`${version}.preview.start`)return ['single','double'].includes(a.mode)&&['easy','normal','hard'].includes(a.difficulty);
 if(a.type===`${version}.preview.lock`)return Array.isArray(a.buildIds)&&[3,4].includes(a.buildIds.length)&&a.buildIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=128);
 if(a.type===`${version}.commands`||a.type===`${version}.replacements`)return Number.isSafeInteger(a.phaseRevision)&&a.phaseRevision>=0&&Array.isArray(a[a.type.endsWith('.commands')?'commands':'replacements'])&&a[a.type.endsWith('.commands')?'commands':'replacements'].length>0;
 return a.type===`${version}.surrender`||a.type==='battleV3.dismiss';
};
const accountPayloadValid=a=>a.type==='bagV1.rankProtection'?typeof a.enabled==='boolean':a.type==='adminGift.claim'?typeof a.giftId==='string'&&a.giftId.length>0&&a.giftId.length<=128:a.type==='mission.claim'?typeof a.category==='string'&&typeof a.missionId==='string':a.type==='mission.claimAll'?typeof a.category==='string':a.type==='build.save'?a.build&&typeof a.build==='object':a.type==='team.save'?a.team&&typeof a.team==='object':a.type==='blueprint.import'?typeof a.blueprint==='string'&&a.blueprint.length<=65536:true;
const valid=action=>action&&typeof action==='object'&&!Array.isArray(action)&&TYPES.has(action.type)&&validId(action.actionId)&&JSON.stringify(action).length<=(action.type==='blueprint.import'?70*1024:8192)&&battlePayloadValid(action)&&accountPayloadValid(action);
export function commerceActionLabel(action){
 if(action?.type?.startsWith('battleV3.')||action?.type?.startsWith('battleV2.'))return 'PvE battle action';
 if(action?.type==='shopV3.buy')return action.payment==='ticket'?'Shop Ticket purchase':'VP purchase';
 if(action?.type==='recruitV3.refresh')return 'Recruitment refresh';
 if(action?.type==='recruitV3.trial')return 'Pokémon Trial';
 if(action?.type==='recruitV3.permanent')return action.payment==='ticket'?'Recruitment Ticket use':'Pokémon recruitment';
 if(action?.type?.startsWith('mission.'))return 'Mission reward';
 if(action?.type==='adminGift.claim')return 'Mailbox gift claim';
 if(action?.type==='bagV1.rankProtection')return 'Rank protection setting';
 if(action?.type==='build.save')return 'Legacy Training save';
 if(action?.type==='team.save')return 'Legacy Team save';
 if(action?.type==='blueprint.import')return 'Legacy Blueprint import';
 return 'action';
}
export class CommercePendingActions{
 constructor({storage=null,scope}={}){
  this.storage=storage;this.key=`pv:commerce-pending:v1:${String(scope||'').slice(0,128)}`;this.current=null;this.lastError=null;this.persistent=!!storage;
  try{const data=JSON.parse(storage?.getItem(this.key)||'null');if(data?.version===1&&valid(data.action))this.current=data.action;}catch{this.persistent=false;}
 }
 get pending(){return this.current?structuredClone(this.current):null;}
 save(){try{if(this.current)this.storage?.setItem(this.key,JSON.stringify({version:1,action:this.current}));else this.storage?.removeItem(this.key);return !!this.storage;}catch{this.persistent=false;return false;}}
 begin(action){if(!valid(action)||this.current)return false;this.current=structuredClone(action);this.lastError=null;this.save();return true;}
 acknowledge(id){if(!this.current||id!==this.current.actionId)return false;this.current=null;this.lastError=null;this.save();return true;}
 reject(id,error){if(!this.current||id!==this.current.actionId)return false;this.lastError=String(error||'Server rejected the action').slice(0,140);return true;}
 discard(){this.current=null;this.lastError=null;this.save();}
 retry(sendAction){if(!this.current)return false;this.lastError=null;return !!sendAction(structuredClone(this.current));}
}
export function createCommerceRetryController({outbox,sendAction,isBusy,isReady,notify=()=>{},onChange=()=>{}}){
 const canRetry=()=>isReady()&&!isBusy();
 const send=action=>{
  if(!isReady()||isBusy()){notify('Wait until the server is ready before submitting this action.');return false;}
  if(!outbox.begin(action)){notify('Resolve the pending Shop, Recruitment or battle action first.');return false;}
  if(!outbox.persistent)notify('Session storage is blocked: keep this page open until your action is confirmed.');
  const sent=sendAction(action);if(!sent)onChange();return sent;
 };
 const retry=()=>{if(!canRetry()){notify('Wait for the server to reconnect and sync.');return false;}const sent=outbox.retry(sendAction);onChange();return sent;};
 return {send,retry,canRetry};
}
