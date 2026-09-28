// Move-specific contract and secondary-effects checks.
import {TARGET_MODES} from '../rules-v3/targets.mjs';
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {MAJOR_STATUS_IDS,VOLATILE_STATUS_IDS,BATTLE_STAGES,SECONDARY_EFFECT_KINDS,MOVE_TAG_IDS,TERRAIN_IDS} from './manifest-values.mjs';
export function validateMoveManifest(manifest){
 const problems=[];
   if(!TARGET_MODES.includes(manifest.targetMode))problems.push('move targetMode is required');
  if(!Number.isInteger(manifest.priority))problems.push('move priority must be an integer');
  if(typeof manifest.contact!=='boolean')problems.push('move contact must be boolean');
  if(manifest.bypassSubstitute!==undefined&&typeof manifest.bypassSubstitute!=='boolean')problems.push('move bypassSubstitute must be boolean');
  if(manifest.sleepUsable!==undefined&&typeof manifest.sleepUsable!=='boolean')problems.push('move sleepUsable must be boolean');
  if(manifest.thawsUser!==undefined&&typeof manifest.thawsUser!=='boolean')problems.push('move thawsUser must be boolean');
  if(manifest.thawsUserIfUserTypes!==undefined&&(!Array.isArray(manifest.thawsUserIfUserTypes)||!manifest.thawsUserIfUserTypes.length||new Set(manifest.thawsUserIfUserTypes).size!==manifest.thawsUserIfUserTypes.length||manifest.thawsUserIfUserTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('move thawsUserIfUserTypes must contain distinct canonical types');
  if(manifest.criticalRatioStages!==undefined&&(!Number.isInteger(manifest.criticalRatioStages)||manifest.criticalRatioStages<0||manifest.criticalRatioStages>3))problems.push('move criticalRatioStages must be an integer from 0 to 3');
  if(manifest.alwaysCritical!==undefined&&typeof manifest.alwaysCritical!=='boolean')problems.push('move alwaysCritical must be boolean');
  if(manifest.damageProfile!==undefined){const profile=manifest.damageProfile;if(!profile||typeof profile!=='object'||Array.isArray(profile))problems.push('move damageProfile must be an object');else{if(profile.secondaryAttackType!==undefined&&!CANONICAL_TYPES.includes(profile.secondaryAttackType))problems.push('move damageProfile secondaryAttackType must be canonical');if(profile.offensiveStat!==undefined&&!['atk','def','spa','spd','spe'].includes(profile.offensiveStat))problems.push('move damageProfile offensiveStat must be a battle stat');if(profile.offensiveSource!==undefined&&!['user','target'].includes(profile.offensiveSource))problems.push('move damageProfile offensiveSource must be user or target');if(profile.defensiveStat!==undefined&&!['def','spd'].includes(profile.defensiveStat))problems.push('move damageProfile defensiveStat must be def or spd');if(profile.ignoreDefensiveStages!==undefined&&typeof profile.ignoreDefensiveStages!=='boolean')problems.push('move damageProfile ignoreDefensiveStages must be boolean');if(profile.minTargetHp!==undefined&&(!Number.isInteger(profile.minTargetHp)||profile.minTargetHp<0))problems.push('move damageProfile minTargetHp must be a non-negative integer');if(profile.typeEffectivenessOverrides!==undefined){const overrides=profile.typeEffectivenessOverrides;if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||!Object.keys(overrides).length)problems.push('move damageProfile typeEffectivenessOverrides must be a non-empty object');else for(const [type,value] of Object.entries(overrides)){if(!CANONICAL_TYPES.includes(type))problems.push(`move damageProfile typeEffectivenessOverrides has unknown type: ${type}`);if(![0,0.25,0.5,1,2,4].includes(value))problems.push(`move damageProfile typeEffectivenessOverrides.${type} must be a supported effectiveness multiplier`);}}}}
  if(manifest.turnOrder!==undefined){const turnOrder=manifest.turnOrder;if(!turnOrder||typeof turnOrder!=='object'||Array.isArray(turnOrder))problems.push('move turnOrder must be an object');else{const terrain=turnOrder.terrainPriority;if(terrain!==undefined){if(!terrain||typeof terrain!=='object'||Array.isArray(terrain)||!TERRAIN_IDS.includes(terrain.terrain)||!Number.isInteger(terrain.priorityDelta)||terrain.priorityDelta===0)problems.push('move turnOrder terrainPriority requires supported terrain and non-zero integer delta');if(terrain?.requireGrounded!==undefined&&typeof terrain.requireGrounded!=='boolean')problems.push('move turnOrder terrainPriority requireGrounded must be boolean');}const volatile=turnOrder.prepareVolatile;if(volatile!==undefined){if(!volatile||typeof volatile!=='object'||Array.isArray(volatile)||typeof volatile.id!=='string'||!volatile.id)problems.push('move turnOrder prepareVolatile requires an id');if(volatile?.endTurnTimer!==undefined&&(!Number.isInteger(volatile.endTurnTimer)||volatile.endTurnTimer<1))problems.push('move turnOrder prepareVolatile endTurnTimer must be positive');if(volatile?.contactBurn!==undefined&&typeof volatile.contactBurn!=='boolean')problems.push('move turnOrder prepareVolatile contactBurn must be boolean');}if(terrain===undefined&&volatile===undefined)problems.push('move turnOrder requires terrainPriority or prepareVolatile');}}
  if(manifest.tags!==undefined&&(!Array.isArray(manifest.tags)||new Set(manifest.tags).size!==manifest.tags.length||manifest.tags.some(tag=>!MOVE_TAG_IDS.includes(tag))))problems.push('move tags must contain distinct supported tags');
  if(manifest.secondaryEffects!==undefined){
   if(!Array.isArray(manifest.secondaryEffects)||!manifest.secondaryEffects.length)problems.push('move secondaryEffects must be a non-empty array when provided');
   else for(const [index,effect] of manifest.secondaryEffects.entries())problems.push(...validateSecondaryEffect(effect).map(problem=>`secondaryEffects[${index}] ${problem}`));
   if(!(manifest.handlers||[]).some(handler=>handler.id==='apply-secondary-effects'))problems.push('move secondaryEffects require apply-secondary-effects handler');
  }
  if((manifest.handlers||[]).some(handler=>handler.id==='apply-secondary-effects')&&!Array.isArray(manifest.secondaryEffects))problems.push('apply-secondary-effects requires move secondaryEffects');
  if(manifest.bypassesProtect!==undefined&&typeof manifest.bypassesProtect!=='boolean')problems.push('move bypassesProtect must be boolean');
 return problems;
}
function validateSecondaryEffect(effect){
 const problems=[];
 if(!effect||typeof effect!=='object'||Array.isArray(effect))return ['must be an object'];
 if(!SECONDARY_EFFECT_KINDS.includes(effect.kind))problems.push(`has unsupported kind: ${effect.kind}`);
 if(!Number.isInteger(effect.chance)||effect.chance<1||effect.chance>100)problems.push('chance must be an integer from 1 to 100');
 if(effect.target!==undefined&&effect.target!=='self')problems.push('target must be self when provided');
 if(effect.condition!==undefined&&!['target-stats-raised-this-turn'].includes(effect.condition))problems.push(`has unsupported condition: ${effect.condition}`);
 if(effect.target==='self'&&effect.kind!=='stat-stages')problems.push('self secondary effects currently require stat-stages');
 if(effect.kind==='major-status'){
  if(!MAJOR_STATUS_IDS.includes(effect.status))problems.push(`has unsupported major status: ${effect.status}`);
  if(effect.blockedTargetTypes!==undefined&&(!Array.isArray(effect.blockedTargetTypes)||new Set(effect.blockedTargetTypes).size!==effect.blockedTargetTypes.length||effect.blockedTargetTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('blockedTargetTypes must contain distinct canonical types');
 }
 if(effect.kind==='random-major-status'){const statuses=effect.statuses;if(!Array.isArray(statuses)||statuses.length<2||new Set(statuses).size!==statuses.length||statuses.some(status=>!MAJOR_STATUS_IDS.includes(status)))problems.push('random-major-status requires at least two distinct supported statuses');}
 if(effect.kind==='volatile-status'&&!VOLATILE_STATUS_IDS.includes(effect.volatile))problems.push(`has unsupported volatile status: ${effect.volatile}`);
 if(effect.kind==='stat-stages'){
  const boosts=effect.boosts,values=boosts&&typeof boosts==='object'&&!Array.isArray(boosts)?Object.entries(boosts):[];
  if(!values.length)problems.push('stat-stages requires boosts');
  for(const [stat,delta] of values){if(!BATTLE_STAGES.includes(stat))problems.push(`has unknown battle stage: ${stat}`);if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`has invalid stage delta for ${stat}`);}
 }
 return problems;
}
