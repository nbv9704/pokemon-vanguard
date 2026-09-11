import {TARGET_MODES} from '../rules-v3/targets.mjs';

export const CONTENT_KINDS=['moves','abilities','items'];
export const BATTLE_FORMATS=['single','double'];
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
