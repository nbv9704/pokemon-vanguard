import {TARGET_MODES} from '../rules-v3/targets.mjs';
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {validatePassiveHandler} from './passive-effects.mjs';

export const CONTENT_KINDS=['moves','abilities','items'];
export const BATTLE_FORMATS=['single','double'];
export const BATTLE_STAGES=['atk','def','spa','spd','spe','accuracy','evasion'];
export const MAJOR_STATUS_IDS=['burn','paralysis','poison','sleep','freeze','bad-poison'];
export const VOLATILE_STATUS_IDS=['confusion','flinch','taunt','encore','disable','leech-seed'];
export const VARIABLE_POWER_FORMULAS=['low-user-hp','user-hp-proportional','faster-user','slower-user','positive-stages','fainted-allies','user-status-non-sleep','target-status','target-poison','target-hp-proportional','random-double'];
export const WEATHER_IDS=['sun','rain'];
export const TERRAIN_IDS=['electric','grassy','misty','psychic'];
export const SIDE_CONDITION_IDS=['tailwind','reflect','light-screen'];
export const HAZARD_IDS=['stealth-rock','spikes','toxic-spikes'];
export const ROOM_IDS=['trick-room','wonder-room','magic-room'];
export const DELAYED_EFFECT_IDS=['yawn','perish-song'];
export const TWO_TURN_MOVE_KINDS=['solar-charge','semi-invulnerable'];
export const SEMI_INVULNERABLE_MODES=['underground','underwater','airborne','vanished'];
export const MOVE_TAG_IDS=['sound','punch','bullet'];
export const SECONDARY_EFFECT_KINDS=['major-status','volatile-status','stat-stages'];
export const HOOKS=['onEntry','beforeAction','onTryMove','beforeTarget','modifyAccuracy','modifyPower','modifyAttack','modifyDefense','modifySpeed','modifyDamage','onDamage','afterDamage','afterStatus','onMove','onSwitchOut','endTurn','onFaint'];

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
  if(entry?.id==='apply-side-protection'&&!['wide-guard','quick-guard'].includes(entry.params?.guard))problems.push('apply-side-protection requires a supported guard');
  if(entry?.id==='apply-protection'&&entry.params?.retaliation&&!['spiky-damage','lower-attack','poison'].includes(entry.params.retaliation))problems.push('apply-protection requires a supported retaliation');
  if(entry?.id==='apply-protection'&&entry.params?.blocksStatus!==undefined&&typeof entry.params.blocksStatus!=='boolean')problems.push('apply-protection blocksStatus must be boolean');
  if(entry?.id==='apply-redirection'&&!['follow-me','rage-powder'].includes(entry.params?.kind))problems.push('apply-redirection requires a supported kind');
  if(entry?.id==='apply-forced-switch'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-forced-switch requireDamage must be boolean');
  if(entry?.id==='apply-weather'){
   if(!WEATHER_IDS.includes(entry.params?.weather))problems.push('apply-weather requires a supported weather');
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-weather turns must be a positive integer');
  }
  if(['weather-speed','weather-duration','weather-heal'].includes(entry?.id)&&!WEATHER_IDS.includes(entry.params?.weather))problems.push(`${entry.id} requires a supported weather`);
  if(entry?.id==='apply-terrain'){
   if(!TERRAIN_IDS.includes(entry.params?.terrain))problems.push('apply-terrain requires a supported terrain');
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-terrain turns must be a positive integer');
  }
  if(entry?.id==='terrain-duration'&&(!Number.isInteger(entry.params?.turns)||entry.params.turns<1))problems.push('terrain-duration requires positive turns');
  if(entry?.id==='weather-speed'&&(!Number.isFinite(entry.params?.multiplier)||entry.params.multiplier<=1))problems.push('weather-speed requires multiplier > 1');
  if(entry?.id==='weather-duration'&&(!Number.isInteger(entry.params?.turns)||entry.params.turns<1))problems.push('weather-duration requires positive turns');
  if(entry?.id==='weather-heal'){
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;
   if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push('weather-heal requires a valid positive fraction');
  }
  if(entry?.id==='apply-hazard'&&!HAZARD_IDS.includes(entry.params?.hazard))problems.push('apply-hazard requires a supported hazard');
  if(entry?.id==='apply-room'){
   if(!ROOM_IDS.includes(entry.params?.room))problems.push('apply-room requires a supported room');
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-room turns must be a positive integer');
  }
  if(entry?.id==='prepare-two-turn-move'){
   if(!TWO_TURN_MOVE_KINDS.includes(entry.params?.kind))problems.push('prepare-two-turn-move requires a supported kind');
   if(entry.params?.sunSkipsCharge!==undefined&&typeof entry.params.sunSkipsCharge!=='boolean')problems.push('prepare-two-turn-move sunSkipsCharge must be boolean');
   if(entry.params?.kind==='semi-invulnerable'&&!SEMI_INVULNERABLE_MODES.includes(entry.params?.semiInvulnerable))problems.push('prepare-two-turn-move requires a supported semiInvulnerable mode');
   if(entry.params?.kind!=='semi-invulnerable'&&entry.params?.semiInvulnerable!==undefined)problems.push('prepare-two-turn-move semiInvulnerable requires semi-invulnerable kind');
  }
  if(entry?.id==='modify-charge-power'&&entry.params?.rainMultiplier!==0.5)problems.push('modify-charge-power currently requires rainMultiplier 0.5');
  if(entry?.id==='apply-recharge'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-recharge requireDamage must be boolean');
  if(entry?.id==='schedule-delayed-effect'){
   if(!DELAYED_EFFECT_IDS.includes(entry.params?.effect))problems.push('schedule-delayed-effect requires a supported effect');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('schedule-delayed-effect turns must be a positive integer');
   if(entry.params?.scope!==undefined&&entry.params.scope!=='all-active')problems.push('schedule-delayed-effect scope must be all-active when provided');
  }
  if(entry?.id==='cleanup-battlefield-effects'&&!['rapid-spin','defog'].includes(entry.params?.mode))problems.push('cleanup-battlefield-effects requires a supported mode');
  if(entry?.id==='apply-side-condition'){
   if(!SIDE_CONDITION_IDS.includes(entry.params?.condition))problems.push('apply-side-condition requires a supported condition');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('apply-side-condition turns must be a positive integer');
  }
  if(entry?.id==='screen-duration'){
   if(!Array.isArray(entry.params?.conditions)||!entry.params.conditions.length||entry.params.conditions.some(condition=>!['reflect','light-screen'].includes(condition)))problems.push('screen-duration requires supported screen conditions');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('screen-duration turns must be a positive integer');
  }
  if(entry?.id==='apply-secondary-effects'&&kind!=='moves')problems.push('apply-secondary-effects is only valid for moves');
  if(['item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-status-cure'].includes(entry?.id)&&kind!=='items')problems.push(`${entry.id} is only valid for items`);
  if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-stat-boost','weather-residual-damage','weather-status-immunity','type-immunity-boost','critical-damage-boost','base-power-threshold-boost','move-tag-power-boost','move-tag-immunity','remove-contact','move-type-by-tag','secondary-effect-power-boost','item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-status-cure'].includes(entry?.id))problems.push(...validatePassiveHandler(entry));
  if(keys.has(key))problems.push(`duplicate handler declaration: ${key}`);keys.add(key);
 }
 for(const format of BATTLE_FORMATS)if(!Array.isArray(manifest.testEvidence?.[format]))problems.push(`${format} testEvidence must be an array`);
 if(kind==='moves'){
  if(!TARGET_MODES.includes(manifest.targetMode))problems.push('move targetMode is required');
  if(!Number.isInteger(manifest.priority))problems.push('move priority must be an integer');
  if(typeof manifest.contact!=='boolean')problems.push('move contact must be boolean');
  if(manifest.tags!==undefined&&(!Array.isArray(manifest.tags)||new Set(manifest.tags).size!==manifest.tags.length||manifest.tags.some(tag=>!MOVE_TAG_IDS.includes(tag))))problems.push('move tags must contain distinct supported tags');
  if(manifest.secondaryEffects!==undefined){
   if(!Array.isArray(manifest.secondaryEffects)||!manifest.secondaryEffects.length)problems.push('move secondaryEffects must be a non-empty array when provided');
   else for(const [index,effect] of manifest.secondaryEffects.entries())problems.push(...validateSecondaryEffect(effect).map(problem=>`secondaryEffects[${index}] ${problem}`));
   if(!(manifest.handlers||[]).some(handler=>handler.id==='apply-secondary-effects'))problems.push('move secondaryEffects require apply-secondary-effects handler');
  }
  if((manifest.handlers||[]).some(handler=>handler.id==='apply-secondary-effects')&&!Array.isArray(manifest.secondaryEffects))problems.push('apply-secondary-effects requires move secondaryEffects');
  if(manifest.bypassesProtect!==undefined&&typeof manifest.bypassesProtect!=='boolean')problems.push('move bypassesProtect must be boolean');
 }
 return problems;
}


function validateSecondaryEffect(effect){
 const problems=[];
 if(!effect||typeof effect!=='object'||Array.isArray(effect))return ['must be an object'];
 if(!SECONDARY_EFFECT_KINDS.includes(effect.kind))problems.push(`has unsupported kind: ${effect.kind}`);
 if(!Number.isInteger(effect.chance)||effect.chance<1||effect.chance>100)problems.push('chance must be an integer from 1 to 100');
 if(effect.kind==='major-status'){
  if(!MAJOR_STATUS_IDS.includes(effect.status))problems.push(`has unsupported major status: ${effect.status}`);
  if(effect.blockedTargetTypes!==undefined&&(!Array.isArray(effect.blockedTargetTypes)||new Set(effect.blockedTargetTypes).size!==effect.blockedTargetTypes.length||effect.blockedTargetTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('blockedTargetTypes must contain distinct canonical types');
 }
 if(effect.kind==='volatile-status'&&!VOLATILE_STATUS_IDS.includes(effect.volatile))problems.push(`has unsupported volatile status: ${effect.volatile}`);
 if(effect.kind==='stat-stages'){
  const boosts=effect.boosts,values=boosts&&typeof boosts==='object'&&!Array.isArray(boosts)?Object.entries(boosts):[];
  if(!values.length)problems.push('stat-stages requires boosts');
  for(const [stat,delta] of values){if(!BATTLE_STAGES.includes(stat))problems.push(`has unknown battle stage: ${stat}`);if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`has invalid stage delta for ${stat}`);}
 }
 return problems;
}
