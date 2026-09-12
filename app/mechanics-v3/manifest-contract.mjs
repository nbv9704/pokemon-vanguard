import {TARGET_MODES} from '../rules-v3/targets.mjs';
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';

export const CONTENT_KINDS=['moves','abilities','items'];
export const BATTLE_FORMATS=['single','double'];
export const BATTLE_STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
export const MAJOR_STATUS_IDS=['burn','paralysis','poison'];
export const HOOKS=['onEntry','beforeAction','onTryMove','beforeTarget','modifyAccuracy','modifyPower','modifyAttack','modifyDefense','modifyDamage','onDamage','afterDamage','onMove','onSwitchOut','endTurn','onFaint'];

export function validateMechanicManifest(manifest,kind){
 const problems=[];
 if(!CONTENT_KINDS.includes(kind))return [`unknown content kind: ${kind}`];
 if(!manifest||typeof manifest!=='object')return ['manifest must be an object'];
 if(typeof manifest.id!=='string'||!manifest.id)problems.push('manifest id is required');
 if(!Array.isArray(manifest.handlers)||!manifest.handlers.length)problems.push('at least one handler is required');
 const keys=new Set();
 for(const entry of manifest.handlers||[]){
  const key=`${entry?.hook}:${entry?.id}:${entry?.order}`;
  if(typeof entry?.id!=='string'||!entry.id)problems.push('handler id is required');
  if(!HOOKS.includes(entry?.hook))problems.push(`unknown hook: ${entry?.hook}`);
  if(!Number.isInteger(entry?.order))problems.push(`handler ${entry?.id||'?'} requires an integer order`);
  if(entry?.params!==undefined&&(!entry.params||typeof entry.params!=='object'||Array.isArray(entry.params)))problems.push(`handler ${entry?.id||'?'} params must be an object`);
  if(entry?.id==='apply-stat-stages'){
   const boosts=entry.params?.boosts,values=boosts&&typeof boosts==='object'&&!Array.isArray(boosts)?Object.entries(boosts):[];
   if(!values.length)problems.push('apply-stat-stages requires boosts');
   for(const [stat,delta] of values){
    if(!BATTLE_STAGES.includes(stat))problems.push(`unknown battle stage: ${stat}`);
    if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`invalid stage delta for ${stat}`);
   }
  }
  if(entry?.id==='apply-major-status'){
   if(!MAJOR_STATUS_IDS.includes(entry.params?.status))problems.push(`unsupported major status: ${entry.params?.status}`);
   const blocked=entry.params?.blockedTargetTypes;
   if(blocked!==undefined&&(!Array.isArray(blocked)||new Set(blocked).size!==blocked.length||blocked.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('blockedTargetTypes must contain distinct canonical types');
  }
  if(keys.has(key))problems.push(`duplicate handler declaration: ${key}`);keys.add(key);
 }
 for(const format of BATTLE_FORMATS)if(!Array.isArray(manifest.testEvidence?.[format]))problems.push(`${format} testEvidence must be an array`);
 if(kind==='moves'){
  if(!TARGET_MODES.includes(manifest.targetMode))problems.push('move targetMode is required');
  if(!Number.isInteger(manifest.priority))problems.push('move priority must be an integer');
  if(typeof manifest.contact!=='boolean')problems.push('move contact must be boolean');
 }
 return problems;
}
