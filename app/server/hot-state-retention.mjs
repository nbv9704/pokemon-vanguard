const clone=value=>structuredClone(value);

export const HOT_STATE_COLLECTIONS=Object.freeze([
 {path:'actionReceipts',key:'actionId',limit:512},
 {path:'economyLedger',key:'receiptId',limit:512},
 {path:'rewardReceipts',key:'receiptId',limit:256},
 {path:'socialActionReceiptsV1',key:'actionId',limit:512},
 {path:'adminActionReceiptsV1',key:'actionId',limit:256},
 {path:'adminGiftDeliveryReceiptsV1',key:'campaignId',limit:256},
 {path:'rankedSettlementReceiptsV1',key:'matchId',limit:128}
]);
export const FINISHED_BATTLE_EVENT_LIMIT=512;

const listAt=(state,path)=>state?.[path];
const validKey=value=>typeof value==='string'&&value.length>=1&&value.length<=160;

export function planHotStateCompaction(state){
 const operations=[],records=[];
 for(const config of HOT_STATE_COLLECTIONS){
  const list=listAt(state,config.path),remove=Array.isArray(list)?Math.max(0,list.length-config.limit):0;
  if(!remove)continue;
  const archived=list.slice(0,remove);
  if(archived.some(entry=>!entry||!validKey(entry[config.key])))throw Object.assign(new Error(`Invalid ${config.path} archive key`),{code:'HOT_ARCHIVE_INVALID'});
  operations.push({list,remove});
  records.push(...archived.map(entry=>({collection:config.path,key:String(entry[config.key]),entry:clone(entry)})));
 }
 const battles=[['legacyBattleEvents',state?.battle],['battleV2Events',state?.battleV2?.battle],['battleV3Events',state?.battleV3?.battle]];
 for(const [collection,battle] of battles){
  const list=battle?.events,finished=battle?.phase==='FINISHED'||!!battle?.result,remove=finished&&Array.isArray(list)?Math.max(0,list.length-FINISHED_BATTLE_EVENT_LIMIT):0;
  if(!remove)continue;const battleId=String(battle.id||'battle').slice(0,96),archived=list.slice(0,remove);
  operations.push({list,remove});records.push(...archived.map((entry,index)=>({collection,key:`${battleId}:${index}`,entry:clone(entry)})));
 }
 return {operations,records};
}

export function applyHotStateCompaction(plan){
 for(const {list,remove} of plan.operations)list.splice(0,remove);
}

export function hydrateArchivedRecords(state,records){
 for(const record of records||[]){
  const config=HOT_STATE_COLLECTIONS.find(entry=>entry.path===record?.collection);
  if(!config||!validKey(record.key)||!record.entry||record.entry[config.key]!==record.key)throw Object.assign(new Error('Invalid hot archive record'),{code:'HOT_ARCHIVE_CORRUPT'});
  const list=state[config.path]=Array.isArray(state[config.path])?state[config.path]:[];
  if(!list.some(entry=>entry?.[config.key]===record.key))list.unshift(clone(record.entry));
 }
 return state;
}

export function hotArchiveLookupTargets(key){
 if(!validKey(key))return [];
 return HOT_STATE_COLLECTIONS.map(config=>({collection:config.path,key:String(key)}));
}
