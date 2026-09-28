// Validate individual handlers; no content-format or service dependency.
import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {TARGET_MODES} from '../rules-v3/targets.mjs';
import {validatePassiveHandler} from './passive-handler-validation.mjs';
import {STORED_STATS,BATTLE_STAGES,MAJOR_STATUS_IDS,VOLATILE_STATUS_IDS,
 VARIABLE_POWER_FORMULAS,WEATHER_IDS,TERRAIN_IDS,SIDE_CONDITION_IDS,HAZARD_IDS,
 ROOM_IDS,DELAYED_EFFECT_IDS,TWO_TURN_MOVE_KINDS,SEMI_INVULNERABLE_MODES,
 MOVE_TAG_IDS,HOOKS} from './manifest-values.mjs';

export function validateManifestHandlers(manifest,kind){
 const problems=[];
 const keys=new Set();
 for(const entry of manifest.handlers||[]){
  const key=`${entry?.hook}:${entry?.id}:${entry?.order}`;
  if(typeof entry?.id!=='string'||!entry.id)problems.push('handler id is required');
  if(!HOOKS.includes(entry?.hook))problems.push(`unknown hook: ${entry?.hook}`);
  if(!Number.isInteger(entry?.order))problems.push(`handler ${entry?.id||'?'} requires an integer order`);
  if(entry?.params!==undefined&&(!entry.params||typeof entry.params!=='object'||Array.isArray(entry.params)))problems.push(`handler ${entry?.id||'?'} params must be an object`);
  if(entry?.id==='reject-unusable-item'&&(typeof entry.params?.reason!=='string'||!entry.params.reason))problems.push('reject-unusable-item requires a reason');
  if(entry?.id==='apply-stat-stages'){
   const validateBoosts=(boosts,label)=>{const values=boosts&&typeof boosts==='object'&&!Array.isArray(boosts)?Object.entries(boosts):[];if(!values.length)problems.push(`${label} requires boosts`);for(const [stat,delta] of values){if(!BATTLE_STAGES.includes(stat))problems.push(`unknown battle stage: ${stat}`);if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`invalid stage delta for ${stat}`);}};
   validateBoosts(entry.params?.boosts,'apply-stat-stages');
   if(entry.params?.target!==undefined&&!['self','active-allies'].includes(entry.params.target))problems.push('apply-stat-stages target override must be self or active-allies');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-stat-stages requireDamage must be boolean');
   if(entry.params?.requireTargetFainted!==undefined&&typeof entry.params.requireTargetFainted!=='boolean')problems.push('apply-stat-stages requireTargetFainted must be boolean');
   if(entry.params?.requireChange!==undefined&&typeof entry.params.requireChange!=='boolean')problems.push('apply-stat-stages requireChange must be boolean');
   const requiredAbilities=entry.params?.requireTargetAbilityIds;if(requiredAbilities!==undefined&&(!Array.isArray(requiredAbilities)||!requiredAbilities.length||new Set(requiredAbilities).size!==requiredAbilities.length||requiredAbilities.some(id=>typeof id!=='string'||!id)))problems.push('apply-stat-stages requireTargetAbilityIds must contain distinct ability ids');
   const blocked=entry.params?.blockedTargetTypes;if(blocked!==undefined&&(!Array.isArray(blocked)||new Set(blocked).size!==blocked.length||blocked.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('apply-stat-stages blockedTargetTypes must contain distinct canonical types');
   if(entry.params?.weatherBoosts!==undefined){const weatherBoosts=entry.params.weatherBoosts;if(!weatherBoosts||typeof weatherBoosts!=='object'||Array.isArray(weatherBoosts)||!Object.keys(weatherBoosts).length)problems.push('apply-stat-stages weatherBoosts must be a non-empty object');else for(const [weather,boosts] of Object.entries(weatherBoosts)){if(!WEATHER_IDS.includes(weather))problems.push(`apply-stat-stages weatherBoosts has unsupported weather: ${weather}`);validateBoosts(boosts,`apply-stat-stages weatherBoosts.${weather}`);}}
  }
  if(entry?.id==='apply-gravity'&&entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-gravity turns must be a positive integer');
  if(entry?.id==='apply-weight-state'){
   if(!Number.isInteger(entry.params?.reductionHg)||entry.params.reductionHg<1)problems.push('apply-weight-state requires positive integer reductionHg');
   if(entry.params?.requireStatChange!==undefined&&typeof entry.params.requireStatChange!=='boolean')problems.push('apply-weight-state requireStatChange must be boolean');
  }
  if(entry?.id==='prepare-target-stat-heal'){
   if(!STORED_STATS.includes(entry.params?.stat))problems.push('prepare-target-stat-heal requires a stored stat');
   if(entry.params?.failAtStageFloor!==undefined&&typeof entry.params.failAtStageFloor!=='boolean')problems.push('prepare-target-stat-heal failAtStageFloor must be boolean');
  }
  if(entry?.id==='apply-prepared-stat-heal'&&entry.params?.source!==undefined&&(typeof entry.params.source!=='string'||!entry.params.source))problems.push('apply-prepared-stat-heal source must be a non-empty string');
  if(entry?.id==='apply-recurring-stat-drop'){
   if(!BATTLE_STAGES.includes(entry.params?.stat))problems.push('apply-recurring-stat-drop requires a battle stat');
   if(!Number.isInteger(entry.params?.delta)||entry.params.delta===0||entry.params.delta<-6||entry.params.delta>6)problems.push('apply-recurring-stat-drop delta must be a non-zero integer from -6 to 6');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('apply-recurring-stat-drop turns must be a positive integer');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-recurring-stat-drop requireDamage must be boolean');
  }
  if(entry?.id==='prepare-gravity-power'&&(!(entry.params?.multiplier>0)||typeof entry.params.multiplier!=='number'))problems.push('prepare-gravity-power requires a positive multiplier');
  if(entry?.id==='apply-rampage-lock'){
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-rampage-lock turns must be a positive integer');
   for(const key of ['confuseOnEnd','blocksSleep'])if(entry.params?.[key]!==undefined&&typeof entry.params[key]!=='boolean')problems.push(`apply-rampage-lock ${key} must be boolean`);
  }
  if(entry?.id==='apply-major-status'){
   if(!MAJOR_STATUS_IDS.includes(entry.params?.status))problems.push(`unsupported major status: ${entry.params?.status}`);
   const blocked=entry.params?.blockedTargetTypes;
   if(blocked!==undefined&&(!Array.isArray(blocked)||new Set(blocked).size!==blocked.length||blocked.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('blockedTargetTypes must contain distinct canonical types');
  }
  if(entry?.id==='apply-volatile-status'&&!VOLATILE_STATUS_IDS.includes(entry.params?.volatile))problems.push(`unsupported volatile status: ${entry.params?.volatile}`);
  if(entry?.id==='schedule-future-attack'){if(entry.params?.effect!==undefined&&entry.params.effect!=='future-attack')problems.push('schedule-future-attack only supports future-attack');if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('schedule-future-attack turns must be a positive integer');}
  if(entry?.id==='prepare-party-hit-powers'){if(entry.params?.basePower!==undefined&&(!Number.isInteger(entry.params.basePower)||entry.params.basePower<1))problems.push('prepare-party-hit-powers basePower must be a positive integer');if(entry.params?.attackDivisor!==undefined&&(!Number.isInteger(entry.params.attackDivisor)||entry.params.attackDivisor<1))problems.push('prepare-party-hit-powers attackDivisor must be a positive integer');}
  if(entry?.id==='check-accuracy'){
   const alwaysHits=entry.params?.alwaysHitsForUserTypes;
   if(alwaysHits!==undefined&&(!Array.isArray(alwaysHits)||new Set(alwaysHits).size!==alwaysHits.length||alwaysHits.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('alwaysHitsForUserTypes must contain distinct canonical types');
   const weather=entry.params?.alwaysHitsInWeather;
   if(weather!==undefined&&(!Array.isArray(weather)||new Set(weather).size!==weather.length||weather.some(id=>!WEATHER_IDS.includes(id))))problems.push('alwaysHitsInWeather must contain distinct supported weather ids');
   const accuracyByWeather=entry.params?.accuracyByWeather;if(accuracyByWeather!==undefined){if(!accuracyByWeather||typeof accuracyByWeather!=='object'||Array.isArray(accuracyByWeather)||!Object.keys(accuracyByWeather).length)problems.push('accuracyByWeather must be a non-empty object');else for(const [id,value] of Object.entries(accuracyByWeather)){if(!WEATHER_IDS.includes(id))problems.push(`accuracyByWeather has unsupported weather: ${id}`);if(!Number.isInteger(value)||value<1||value>100)problems.push(`accuracyByWeather.${id} must be an integer from 1 to 100`);}}
   if(entry.params?.ignoreTargetEvasion!==undefined&&typeof entry.params.ignoreTargetEvasion!=='boolean')problems.push('check-accuracy ignoreTargetEvasion must be boolean');
   if(entry.params?.ignoreSemiInvulnerable!==undefined&&typeof entry.params.ignoreSemiInvulnerable!=='boolean')problems.push('check-accuracy ignoreSemiInvulnerable must be boolean');
   if(entry.params?.ohko!==undefined&&typeof entry.params.ohko!=='boolean')problems.push('check-accuracy ohko must be boolean');
   if(entry.params?.smartSplit!==undefined&&typeof entry.params.smartSplit!=='boolean')problems.push('check-accuracy smartSplit must be boolean');
   for(const key of ['ohkoImmuneTargetTypes','ohkoLowerAccuracyUnlessUserTypes']){const types=entry.params?.[key];if(types!==undefined&&(!Array.isArray(types)||new Set(types).size!==types.length||types.some(type=>!CANONICAL_TYPES.includes(type))))problems.push(`check-accuracy ${key} must contain distinct canonical types`);}
  }
  if(entry?.id==='prepare-field-move'){
   if(entry.params?.requireGrounded!==undefined&&typeof entry.params.requireGrounded!=='boolean')problems.push('prepare-field-move requireGrounded must be boolean');
   const validateProfiles=(profiles,ids,label)=>{if(profiles===undefined)return;if(!profiles||typeof profiles!=='object'||Array.isArray(profiles)||!Object.keys(profiles).length){problems.push(`${label} must be a non-empty object`);return;}for(const [id,profile] of Object.entries(profiles)){if(!ids.includes(id))problems.push(`${label} has unsupported id: ${id}`);if(!profile||typeof profile!=='object'||Array.isArray(profile))problems.push(`${label}.${id} must be an object`);else{if(profile.type!==undefined&&!CANONICAL_TYPES.includes(profile.type))problems.push(`${label}.${id}.type must be canonical`);if(profile.powerMultiplier!==undefined&&(!Number.isFinite(profile.powerMultiplier)||profile.powerMultiplier<=0))problems.push(`${label}.${id}.powerMultiplier must be positive`);if(profile.targetMode!==undefined&&!TARGET_MODES.includes(profile.targetMode))problems.push(`${label}.${id}.targetMode must be supported`);}}};
   validateProfiles(entry.params?.weather,WEATHER_IDS,'prepare-field-move weather');validateProfiles(entry.params?.terrain,TERRAIN_IDS,'prepare-field-move terrain');if(entry.params?.weather===undefined&&entry.params?.terrain===undefined)problems.push('prepare-field-move requires weather or terrain profiles');
  }
  if(entry?.id==='require-field-state'){
   const weatherIds=entry.params?.weatherIds;if(weatherIds!==undefined&&(!Array.isArray(weatherIds)||!weatherIds.length||new Set(weatherIds).size!==weatherIds.length||weatherIds.some(id=>!WEATHER_IDS.includes(id))))problems.push('require-field-state weatherIds must contain distinct supported weather ids');
   const terrain=entry.params?.terrain;if(terrain!==undefined&&terrain!=='any'&&!TERRAIN_IDS.includes(terrain))problems.push('require-field-state terrain must be any or a supported terrain');if(weatherIds===undefined&&terrain===undefined)problems.push('require-field-state requires weatherIds or terrain');
  }
  if(entry?.id==='clear-terrain'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('clear-terrain requireDamage must be boolean');
  if(entry?.id==='require-user-status'){const statuses=entry.params?.statuses;if(!Array.isArray(statuses)||!statuses.length||new Set(statuses).size!==statuses.length||statuses.some(status=>!MAJOR_STATUS_IDS.includes(status)))problems.push('require-user-status requires distinct supported statuses');}
  if(entry?.id==='apply-type-change'){const mode=entry.params?.mode||'replace-fixed',types=entry.params?.types;if(!['replace-fixed','add-fixed','copy-target-to-user'].includes(mode))problems.push('apply-type-change requires a supported mode');if(mode==='copy-target-to-user'){if(types!==undefined)problems.push('copy-target-to-user does not accept fixed types');}else{const max=mode==='add-fixed'?1:2;if(!Array.isArray(types)||types.length<1||types.length>max||new Set(types).size!==types.length||types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push(`apply-type-change ${mode} requires distinct canonical types`);}const blocked=entry.params?.blockedTargetTypes;if(blocked!==undefined&&(!Array.isArray(blocked)||new Set(blocked).size!==blocked.length||blocked.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('apply-type-change blockedTargetTypes must contain distinct canonical types');if(entry.params?.reflectable!==undefined&&typeof entry.params.reflectable!=='boolean')problems.push('apply-type-change reflectable must be boolean');}
  if(entry?.id==='cure-major-status'){if(!['self','damaged-targets'].includes(entry.params?.target))problems.push('cure-major-status requires a supported target');const statuses=entry.params?.statuses;if(!Array.isArray(statuses)||!statuses.length||new Set(statuses).size!==statuses.length||statuses.some(status=>!MAJOR_STATUS_IDS.includes(status)))problems.push('cure-major-status requires distinct supported statuses');}
  if(entry?.id==='deal-multi-hit-damage'){
   const hits=entry.params?.hits,validFixed=Number.isInteger(hits)&&hits>=2&&hits<=10,validRange=Array.isArray(hits)&&hits.length===2&&hits[0]===2&&hits[1]===5;
   if(!validFixed&&!validRange)problems.push('deal-multi-hit-damage supports a fixed 2-10 hit count or the [2,5] distribution');
   if(entry.params?.perHitAccuracy!==undefined&&typeof entry.params.perHitAccuracy!=='boolean')problems.push('deal-multi-hit-damage perHitAccuracy must be boolean');
   if(entry.params?.smartSplit!==undefined&&typeof entry.params.smartSplit!=='boolean')problems.push('deal-multi-hit-damage smartSplit must be boolean');
   if(entry.params?.powerByHit!==undefined&&(!Array.isArray(entry.params.powerByHit)||!validFixed||entry.params.powerByHit.length!==hits||entry.params.powerByHit.some(power=>!Number.isInteger(power)||power<1)))problems.push('deal-multi-hit-damage powerByHit requires one positive integer per fixed hit');
   if(entry.params?.powerStep!==undefined&&(!Number.isFinite(entry.params.powerStep)||entry.params.powerStep<=0))problems.push('deal-multi-hit-damage powerStep must be positive');
  }
  if(entry?.id==='prepare-consecutive-power'){
   if(entry.params?.stateId!==undefined&&(typeof entry.params.stateId!=='string'||!entry.params.stateId))problems.push('prepare-consecutive-power stateId must be a non-empty string');
   if(entry.params?.maxMultiplier!==undefined&&(!Number.isInteger(entry.params.maxMultiplier)||entry.params.maxMultiplier<1))problems.push('prepare-consecutive-power maxMultiplier must be a positive integer');
  }
  if(entry?.id==='apply-next-move-type'&&!CANONICAL_TYPES.includes(entry.params?.type))problems.push('apply-next-move-type requires a canonical type');
  if(entry?.id==='schedule-slot-heal'){
   if(entry.params?.effect!=='wish')problems.push('schedule-slot-heal currently supports wish');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('schedule-slot-heal turns must be a positive integer');
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push('schedule-slot-heal requires a valid positive fraction');
  }
  if(entry?.id==='prepare-best-damage-category'&&Object.keys(entry.params||{}).length)problems.push('prepare-best-damage-category does not accept params');
  if(entry?.id==='clear-user-volatile'&&(typeof entry.params?.volatile!=='string'||!entry.params.volatile))problems.push('clear-user-volatile requires a volatile id');
  if(entry?.id==='deal-direct-damage'&&entry.params?.targetRelation!==undefined&&!['foe','ally'].includes(entry.params.targetRelation))problems.push('deal-direct-damage targetRelation must be foe or ally');
  if(entry?.id==='apply-binding'){
   for(const key of ['minTurns','maxTurns','residualNumerator','residualDenominator'])if(entry.params?.[key]!==undefined&&(!Number.isInteger(entry.params[key])||entry.params[key]<1))problems.push(`apply-binding ${key} must be a positive integer`);
   if(Number.isInteger(entry.params?.minTurns)&&Number.isInteger(entry.params?.maxTurns)&&entry.params.minTurns>entry.params.maxTurns)problems.push('apply-binding minTurns cannot exceed maxTurns');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-binding requireDamage must be boolean');
   if(entry.params?.trapsSwitch!==undefined&&typeof entry.params.trapsSwitch!=='boolean')problems.push('apply-binding trapsSwitch must be boolean');
  }
  if(entry?.id==='equalize-hp'&&Object.keys(entry.params||{}).length)problems.push('equalize-hp does not accept params');
  if(entry?.id==='apply-recoil'||entry?.id==='apply-drain'){
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;
   if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push(`${entry.id} requires a valid positive fraction`);
  }
  if(entry?.id==='apply-heal'){
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;
   if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push('apply-heal requires a valid positive fraction');
   if(!['self','active-allies','hit-targets','hit-allies'].includes(entry.params?.target))problems.push('apply-heal requires a supported target');
   if(entry.params?.weatherScaled!==undefined&&typeof entry.params.weatherScaled!=='boolean')problems.push('apply-heal weatherScaled must be boolean');
   if(entry.params?.stockpileScaled!==undefined&&typeof entry.params.stockpileScaled!=='boolean')problems.push('apply-heal stockpileScaled must be boolean');
   if(entry.params?.abilityBoostTag!==undefined&&!MOVE_TAG_IDS.includes(entry.params.abilityBoostTag))problems.push('apply-heal abilityBoostTag must be a supported move tag');
   if(entry.params?.rounding!==undefined&&!['floor','ceil'].includes(entry.params.rounding))problems.push('apply-heal rounding must be floor or ceil');
   if(entry.params?.failIfNoHealing!==undefined&&typeof entry.params.failIfNoHealing!=='boolean')problems.push('apply-heal failIfNoHealing must be boolean');
  }
  if(entry?.id==='apply-rest'&&Object.keys(entry.params||{}).length)problems.push('apply-rest does not accept params');
  if(entry?.id==='cure-party-status'&&entry.params?.sound!==undefined&&typeof entry.params.sound!=='boolean')problems.push('cure-party-status sound must be boolean');
  if(entry?.id==='require-target-status'){const statuses=entry.params?.statuses;if(!Array.isArray(statuses)||!statuses.length||new Set(statuses).size!==statuses.length||statuses.some(status=>!MAJOR_STATUS_IDS.includes(status)))problems.push('require-target-status requires distinct supported statuses');}
  if(entry?.id==='pay-hp-cost'){
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push('pay-hp-cost requires a valid positive fraction');
   const boosts=entry.params?.requirePotentialStageChange;if(boosts!==undefined){if(!boosts||typeof boosts!=='object'||Array.isArray(boosts)||!Object.keys(boosts).length)problems.push('pay-hp-cost requirePotentialStageChange must be a non-empty boost map');else for(const [stat,delta] of Object.entries(boosts)){if(!BATTLE_STAGES.includes(stat))problems.push(`pay-hp-cost unknown battle stage: ${stat}`);if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`pay-hp-cost invalid stage delta for ${stat}`);}}
   const stageLimit=entry.params?.requireStageBelow;if(stageLimit!==undefined&&(!stageLimit||typeof stageLimit!=='object'||!BATTLE_STAGES.includes(stageLimit.stat)||!Number.isInteger(stageLimit.value)||stageLimit.value<-6||stageLimit.value>6))problems.push('pay-hp-cost requireStageBelow requires stat and stage value');
  }
  if(entry?.id==='apply-random-stat-stage'){const stats=entry.params?.stats;if(!Array.isArray(stats)||!stats.length||new Set(stats).size!==stats.length||stats.some(stat=>!BATTLE_STAGES.includes(stat)))problems.push('apply-random-stat-stage requires distinct battle stats');if(!Number.isInteger(entry.params?.stages)||entry.params.stages===0||entry.params.stages<-6||entry.params.stages>6)problems.push('apply-random-stat-stage requires stages from -6 to 6 excluding 0');}
  if(entry?.id==='swap-stat-stages'){
   const stats=entry.params?.stats;
   if(!Array.isArray(stats)||!stats.length||new Set(stats).size!==stats.length||stats.some(stat=>!BATTLE_STAGES.includes(stat)))problems.push('swap-stat-stages requires distinct battle stats');
  }
  if(entry?.id==='reset-stat-stages'&&!['all-active','damaged-targets'].includes(entry.params?.scope))problems.push('reset-stat-stages requires a supported scope');
  if(entry?.id==='break-side-screens'){
   const conditions=entry.params?.conditions;
   if(!Array.isArray(conditions)||!conditions.length||new Set(conditions).size!==conditions.length||conditions.some(condition=>!['reflect','light-screen','aurora-veil'].includes(condition)))problems.push('break-side-screens requires distinct screen conditions');
  }
  if(entry?.id==='apply-self-sacrifice'&&entry.params?.requireHit!==undefined&&typeof entry.params.requireHit!=='boolean')problems.push('apply-self-sacrifice requireHit must be boolean');
  if(entry?.id==='apply-self-sacrifice'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-self-sacrifice requireDamage must be boolean');
  if(entry?.id==='deal-fixed-damage'){
   if(!['user-level','target-current-fraction','user-current-hp','target-user-hp-difference','prepared-retaliation','target-max-hp'].includes(entry.params?.formula))problems.push('deal-fixed-damage requires a supported formula');
   if(entry.params?.formula==='target-current-fraction'&&(!Number.isInteger(entry.params?.denominator)||entry.params.denominator<2))problems.push('target-current-fraction requires denominator >= 2');
   if(entry.params?.ohko!==undefined&&typeof entry.params.ohko!=='boolean')problems.push('deal-fixed-damage ohko must be boolean');
  }
  if(entry?.id==='prepare-retaliation'){
   if(!['any','physical','special'].includes(entry.params?.category))problems.push('prepare-retaliation requires any, physical, or special category');
   const numerator=entry.params?.numerator,denominator=entry.params?.denominator;if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1)problems.push('prepare-retaliation requires a positive damage multiplier fraction');
  }
  if(entry?.id==='require-not-consecutive'&&Object.keys(entry.params||{}).length)problems.push('require-not-consecutive does not accept params');
  if(entry?.id==='require-other-moves-used'&&Object.keys(entry.params||{}).length)problems.push('require-other-moves-used does not accept params');
  if(entry?.id==='require-pending-damaging-action'&&entry.params?.requirePositivePriority!==undefined&&typeof entry.params.requirePositivePriority!=='boolean')problems.push('require-pending-damaging-action requirePositivePriority must be boolean');
  if(entry?.id==='require-user-unhit'&&Object.keys(entry.params||{}).length)problems.push('require-user-unhit does not accept params');
  if(entry?.id==='reorder-pending-action'&&!['front','back'].includes(entry.params?.position))problems.push('reorder-pending-action requires front or back position');
  if(entry?.id==='require-user-type'&&!CANONICAL_TYPES.includes(entry.params?.type))problems.push('require-user-type requires a canonical type');
  if(entry?.id==='deal-variable-power-damage'){
   if(!VARIABLE_POWER_FORMULAS.includes(entry.params?.formula))problems.push('deal-variable-power-damage requires a supported formula');
   if(['user-hp-proportional','positive-stages','fainted-allies','user-status-non-sleep','target-status','target-poison','target-hp-proportional','random-double','target-grounded-electric-terrain','user-no-held-item','target-held-item-boost'].includes(entry.params?.formula)&&(!Number.isInteger(entry.params?.basePower)||entry.params.basePower<1))problems.push(`${entry.params?.formula} requires positive basePower`);
  }
  if(entry?.id==='require-held-item'&&entry.params?.reveal!==undefined&&typeof entry.params.reveal!=='boolean')problems.push('require-held-item reveal must be boolean');
  if(entry?.id==='require-held-item'&&entry.params?.requireBerry!==undefined&&typeof entry.params.requireBerry!=='boolean')problems.push('require-held-item requireBerry must be boolean');
  if(entry?.id==='apply-berry-action'&&!['eat-target','eat-self','recycle','teatime'].includes(entry.params?.mode))problems.push('apply-berry-action requires a supported mode');
  if(entry?.id==='apply-target-lock'&&entry.params?.endTurnTimer!==undefined&&(!Number.isInteger(entry.params.endTurnTimer)||entry.params.endTurnTimer<1))problems.push('apply-target-lock endTurnTimer must be a positive integer');
  if(entry?.id==='apply-crash-damage'){const n=entry.params?.numerator??1,d=entry.params?.denominator??2;if(!Number.isInteger(n)||!Number.isInteger(d)||n<1||d<1||n>d)problems.push('apply-crash-damage requires a valid positive fraction');}
  if(entry?.id==='reduce-last-move-pp'){if(!Number.isInteger(entry.params?.amount)||entry.params.amount<1)problems.push('reduce-last-move-pp amount must be a positive integer');if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('reduce-last-move-pp requireDamage must be boolean');}
  if(entry?.id==='maximize-stat-stage'){if(!BATTLE_STAGES.includes(entry.params?.stat))problems.push('maximize-stat-stage requires a battle stat');if(!Number.isInteger(entry.params?.value)||entry.params.value<-6||entry.params.value>6)problems.push('maximize-stat-stage value must be an integer from -6 to 6');}
  if(entry?.id==='apply-held-item-action'){
   if(!['remove','steal','swap'].includes(entry.params?.mode))problems.push('apply-held-item-action requires remove, steal, or swap mode');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-held-item-action requireDamage must be boolean');
  }
  if(entry?.id==='modify-active-ability'){
   if(!['swap','copy-target','copy-source','replace-fixed','suppress'].includes(entry.params?.mode))problems.push('modify-active-ability requires a supported mode');
   if(entry.params?.mode==='replace-fixed'&&(typeof entry.params?.abilityId!=='string'||!entry.params.abilityId))problems.push('replace-fixed requires abilityId');
   for(const key of ['blockedSourceAbilityIds','blockedTargetAbilityIds','cureStatuses'])if(entry.params?.[key]!==undefined&&(!Array.isArray(entry.params[key])||entry.params[key].some(value=>typeof value!=='string'||!value)))problems.push(`modify-active-ability ${key} must be a string array`);
   if(entry.params?.cureStatuses?.some(status=>!MAJOR_STATUS_IDS.includes(status)))problems.push('modify-active-ability cureStatuses contains unsupported status');
   if(entry.params?.reflectable!==undefined&&typeof entry.params.reflectable!=='boolean')problems.push('modify-active-ability reflectable must be boolean');
  }
  if(entry?.id==='apply-side-protection'&&!['wide-guard','quick-guard'].includes(entry.params?.guard))problems.push('apply-side-protection requires a supported guard');
  if(entry?.id==='apply-protection'&&entry.params?.retaliation&&!['spiky-damage','lower-attack','poison'].includes(entry.params.retaliation))problems.push('apply-protection requires a supported retaliation');
  if(entry?.id==='apply-protection'&&entry.params?.blocksStatus!==undefined&&typeof entry.params.blocksStatus!=='boolean')problems.push('apply-protection blocksStatus must be boolean');
  if(entry?.id==='apply-endure'&&Object.keys(entry.params||{}).length)problems.push('apply-endure does not accept params');
  if(entry?.id==='apply-charge-state'&&entry.params?.multiplier!==undefined&&(!Number.isFinite(entry.params.multiplier)||entry.params.multiplier<=1))problems.push('apply-charge-state multiplier must be > 1');
  if(entry?.id==='apply-self-hp-damage'){const n=entry.params?.numerator,d=entry.params?.denominator;if(!Number.isInteger(n)||!Number.isInteger(d)||n<1||d<1||n>d)problems.push('apply-self-hp-damage requires a valid positive fraction');if(entry.params?.rounding!==undefined&&!['floor','ceil','round'].includes(entry.params.rounding))problems.push('apply-self-hp-damage rounding must be floor, ceil, or round');}
  if(entry?.id==='apply-type-state'){if(!CANONICAL_TYPES.includes(entry.params?.removeType))problems.push('apply-type-state removeType must be canonical');if(!['turn','switch'].includes(entry.params?.duration))problems.push('apply-type-state duration must be turn or switch');if(entry.params?.requireHit!==undefined&&typeof entry.params.requireHit!=='boolean')problems.push('apply-type-state requireHit must be boolean');if(entry.params?.requireHealing!==undefined&&typeof entry.params.requireHealing!=='boolean')problems.push('apply-type-state requireHealing must be boolean');}
  if(entry?.id==='apply-redirection'&&!['follow-me','rage-powder'].includes(entry.params?.kind))problems.push('apply-redirection requires a supported kind');
  if(entry?.id==='apply-forced-switch'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-forced-switch requireDamage must be boolean');
  if(entry?.id==='apply-pivot-switch'&&entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-pivot-switch requireDamage must be boolean');
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
  if(entry?.id==='apply-hazard'){
   if(!HAZARD_IDS.includes(entry.params?.hazard))problems.push('apply-hazard requires a supported hazard');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-hazard requireDamage must be boolean');
   if(entry.params?.suppressibleSecondary!==undefined&&typeof entry.params.suppressibleSecondary!=='boolean')problems.push('apply-hazard suppressibleSecondary must be boolean');
  }
  if(entry?.id==='copy-stat-stages'){
   const stats=entry.params?.stats;if(stats!==undefined&&(!Array.isArray(stats)||!stats.length||new Set(stats).size!==stats.length||stats.some(stat=>!BATTLE_STAGES.includes(stat))))problems.push('copy-stat-stages stats must contain distinct battle stages');
   const volatiles=entry.params?.copyVolatiles;if(volatiles!==undefined&&(!Array.isArray(volatiles)||new Set(volatiles).size!==volatiles.length||volatiles.some(id=>id!=='focus-energy')))problems.push('copy-stat-stages copyVolatiles currently supports focus-energy only');
  }
  if(entry?.id==='modify-stored-stats'){
   const mode=entry.params?.mode,stats=entry.params?.stats;if(!['swap-target','average-target','swap-self'].includes(mode))problems.push('modify-stored-stats requires a supported mode');
   if(!Array.isArray(stats)||!stats.length||new Set(stats).size!==stats.length||stats.some(stat=>!STORED_STATS.includes(stat)))problems.push('modify-stored-stats stats must contain distinct stored stats');
   if(mode==='swap-self'&&stats?.length!==2)problems.push('modify-stored-stats swap-self requires exactly two stats');
   if(entry.params?.toggleVolatile!==undefined&&(mode!=='swap-self'||entry.params.toggleVolatile!=='power-trick'))problems.push('modify-stored-stats toggleVolatile currently supports power-trick on swap-self only');
  }
  if(entry?.id==='apply-room'){
   if(!ROOM_IDS.includes(entry.params?.room))problems.push('apply-room requires a supported room');
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-room turns must be a positive integer');
  }
  if(entry?.id==='prepare-two-turn-move'){
   if(!TWO_TURN_MOVE_KINDS.includes(entry.params?.kind))problems.push('prepare-two-turn-move requires a supported kind');
   if(entry.params?.sunSkipsCharge!==undefined&&typeof entry.params.sunSkipsCharge!=='boolean')problems.push('prepare-two-turn-move sunSkipsCharge must be boolean');
   if(entry.params?.skipChargeInWeather!==undefined&&(!Array.isArray(entry.params.skipChargeInWeather)||new Set(entry.params.skipChargeInWeather).size!==entry.params.skipChargeInWeather.length||entry.params.skipChargeInWeather.some(id=>!WEATHER_IDS.includes(id))))problems.push('prepare-two-turn-move skipChargeInWeather must contain distinct supported weather ids');
   if(entry.params?.chargeBoosts!==undefined){const boosts=entry.params.chargeBoosts;if(!boosts||typeof boosts!=='object'||Array.isArray(boosts)||!Object.keys(boosts).length)problems.push('prepare-two-turn-move chargeBoosts must be a non-empty object');else for(const [stat,delta] of Object.entries(boosts)){if(!BATTLE_STAGES.includes(stat))problems.push(`prepare-two-turn-move chargeBoosts has unknown stat: ${stat}`);if(!Number.isInteger(delta)||delta===0||delta<-6||delta>6)problems.push(`prepare-two-turn-move chargeBoosts.${stat} must be a non-zero integer from -6 to 6`);}}
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
  if(entry?.id==='cleanup-battlefield-effects'&&!['rapid-spin','defog','mortal-spin','tidy-up'].includes(entry.params?.mode))problems.push('cleanup-battlefield-effects requires a supported mode');
  if(entry?.id==='apply-persistent-effect'){
   if(!['trapped','ingrain','aqua-ring','salt-cure','magnet-rise','imprison'].includes(entry.params?.effect))problems.push('apply-persistent-effect requires a supported effect');
   if(entry.params?.target!==undefined&&!['self'].includes(entry.params.target))problems.push('apply-persistent-effect target override must be self');
   if(entry.params?.requireDamage!==undefined&&typeof entry.params.requireDamage!=='boolean')problems.push('apply-persistent-effect requireDamage must be boolean');
   if(entry.params?.turns!==undefined&&(!Number.isInteger(entry.params.turns)||entry.params.turns<1))problems.push('apply-persistent-effect turns must be a positive integer');
  }
  if(entry?.id==='apply-transform'&&Object.keys(entry.params||{}).length)problems.push('apply-transform does not accept params');
  if(entry?.id==='prepare-form-dependent-move'){const mapping=entry.params?.typeBySpecies;if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||!Object.keys(mapping).length||Object.values(mapping).some(type=>!CANONICAL_TYPES.includes(type)))problems.push('prepare-form-dependent-move requires canonical typeBySpecies mappings');}
  if(entry?.id==='apply-substitute'&&Object.keys(entry.params||{}).length)problems.push('apply-substitute does not accept params');
  if(entry?.id==='apply-side-condition'){
   if(!SIDE_CONDITION_IDS.includes(entry.params?.condition))problems.push('apply-side-condition requires a supported condition');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('apply-side-condition turns must be a positive integer');
  }
  if(entry?.id==='screen-duration'){
   if(!Array.isArray(entry.params?.conditions)||!entry.params.conditions.length||entry.params.conditions.some(condition=>!['reflect','light-screen','aurora-veil'].includes(condition)))problems.push('screen-duration requires supported screen conditions');
   if(!Number.isInteger(entry.params?.turns)||entry.params.turns<1)problems.push('screen-duration turns must be a positive integer');
  }
  if(entry?.id==='apply-secondary-effects'&&kind!=='moves')problems.push('apply-secondary-effects is only valid for moves');
  if(['item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-status-cure','item-post-move-recoil','item-contact-retaliation','item-damage-heal','item-speed-boost','item-choice-lock','item-holder-switch','item-binding-damage-boost','item-switch-escape'].includes(entry?.id)&&kind!=='items')problems.push(`${entry.id} is only valid for items`);
  if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-stat-boost','weather-residual-damage','weather-status-immunity','weather-type-damage-boost','field-type-damage-aura','weather-residual-immunity','weather-incoming-accuracy-modifier','volatile-incoming-accuracy-modifier','type-immunity-boost','type-immunity-response','status-type-immunity-bypass','priority-move-immunity-aura','ally-major-status-immunity','ally-volatile-immunity','ally-stat-drop-immunity','held-item-suppression','grounding-immunity','move-type-conversion','outgoing-secondary-effect','turn-order-modifier','opponent-berry-suppression','type-immunity-bypass','end-turn-berry-restore','end-turn-ally-status-cure','item-loss-speed-boost','late-move-power-boost','berry-consumption-heal','weather-suppression','damage-response-disable','sleep-counter-rate','damage-charge-type','entry-item-reveal','stat-drop-reflect','end-turn-random-stat-shift','redirection-immunity','target-pp-pressure','pre-move-type-change','redirection-bypass','entry-fainted-ally-power-boost','stat-change-inversion','global-move-block','type-redirection','side-condition-bypass','opponent-stat-gain-copy','berry-effect-multiplier','opponent-stage-ignore','entry-ability-copy','ally-faint-ability-copy','contact-ability-replace','contact-ability-swap','indirect-damage-immunity','entry-danger-sense','opponent-ability-bypass','status-move-reflect','field-type-change','disguise-shield','stance-form-change','entry-transform','entry-illusion','end-turn-form-toggle','switch-out-form-change','received-type-damage-modifier','contact-response','damage-response','ko-stat-boost','end-turn-stat-boost','lethal-hit-survival','stat-drop-response','volatile-immunity','critical-vs-status','status-residual-heal','status-reflect','flinch-stat-boost','critical-damage-boost','base-power-threshold-boost','move-tag-power-boost','move-tag-immunity','remove-contact','move-type-by-tag','secondary-effect-power-boost','stat-multiplier','gender-damage-modifier','weight-modifier','outgoing-accuracy-modifier','contact-power-boost','recoil-power-boost','major-status-immunity','critical-ratio','critical-immunity','stab-modifier','recoil-immunity','received-damage-modifier','contact-protection-pierce','parental-bond','opponent-switch-trap','always-hit','burn-attack-penalty-immunity','stat-drop-immunity','ally-damage-immunity','ally-damage-reduction','ally-ability-stat-multiplier','secondary-effect-immunity','multi-hit-max','weather-status-cure','paralysis-speed-penalty-immunity','switch-out-status-cure','switch-out-heal','random-status-cure','entry-weather','entry-terrain','entry-stat-drop','entry-screen-cleaner','entry-ally-stage-reset','entry-ally-heal','item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-status-cure','item-post-move-recoil','item-contact-retaliation','item-damage-heal','item-speed-boost','item-choice-lock','item-holder-switch','item-binding-damage-boost','item-switch-escape'].includes(entry?.id))problems.push(...validatePassiveHandler(entry));
  if(keys.has(key))problems.push(`duplicate handler declaration: ${key}`);keys.add(key);
 }
 return problems;
}
