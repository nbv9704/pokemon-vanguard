import {TARGET_MODES} from '../rules-v3/targets.mjs';
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';

export const CONTENT_KINDS=['moves','abilities','items'];
export const BATTLE_FORMATS=['single','double'];
export const BATTLE_STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
export const MAJOR_STATUS_IDS=['burn','paralysis','poison','sleep','freeze','bad-poison'];
export const VOLATILE_STATUS_IDS=['confusion','flinch','taunt','encore','disable','leech-seed'];
export const VARIABLE_POWER_FORMULAS=['low-user-hp','user-hp-proportional','faster-user','slower-user','positive-stages','fainted-allies','user-status-non-sleep','target-status','target-poison','target-hp-proportional','random-double'];
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
   if(entry.params?.target!==undefined&&entry.params.target!=='self')problems.push('apply-stat-stages target override must be self');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-stat-stages requireDamage must be boolean');
  }
  if(entry?.id==='apply-major-status'){
   if(!MAJOR_STATUS_IDS.includes(entry.params?.status))problems.push(`unsupported major status: ${entry.params?.status}`);
   const blocked=entry.params?.blockedTargetTypes;
   if(blocked!==undefined&&(!Array.isArray(blocked)||new Set(blocked).size!==blocked.length||blocked.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('blockedTargetTypes must contain distinct canonical types');
  }
  if(entry?.id==='apply-volatile-status'&&!VOLATILE_STATUS_IDS.includes(entry.params?.volatile))problems.push(`unsupported volatile status: ${entry.params?.volatile}`);
  if(entry?.id==='check-accuracy'){
   const alwaysHits=entry.params?.alwaysHitsForUserTypes;
   if(alwaysHits!==undefined&&(!Array.isArray(alwaysHits)||new Set(alwaysHits).size!==alwaysHits.length||alwaysHits.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('alwaysHitsForUserTypes must contain distinct canonical types');
  }
  if(entry?.id==='deal-multi-hit-damage'){
   const hits=entry.params?.hits,validFixed=Number.isInteger(hits)&&hits>=2&&hits<=10,validRange=Array.isArray(hits)&&hits.length===2&&hits[0]===2&&hits[1]===5;
   if(!validFixed&&!validRange)problems.push('deal-multi-hit-damage supports a fixed 2-10 hit count or the [2,5] distribution');
  }
  if(entry?.id==='apply-recoil'||entry?.id==='apply-drain'){
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;
   if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push(`${entry.id} requires a valid positive fraction`);
  }
  if(entry?.id==='deal-fixed-damage'){
   if(!['user-level','target-current-fraction'].includes(entry.params?.formula))problems.push('deal-fixed-damage requires a supported formula');
   if(entry.params?.formula==='target-current-fraction'&&(!Number.isInteger(entry.params?.denominator)||entry.params.denominator<2))problems.push('target-current-fraction requires denominator >= 2');
  }
  if(entry?.id==='deal-variable-power-damage'){
   if(!VARIABLE_POWER_FORMULAS.includes(entry.params?.formula))problems.push('deal-variable-power-damage requires a supported formula');
   if(['user-hp-proportional','positive-stages','fainted-allies','user-status-non-sleep','target-status','target-poison','target-hp-proportional','random-double'].includes(entry.params?.formula)&&(!Number.isInteger(entry.params?.basePower)||entry.params.basePower<1))problems.push(`${entry.params?.formula} requires positive basePower`);
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
