import {CANONICAL_TYPES} from '../../rules-v3/type-chart.mjs';

const ITEM_HANDLER_IDS=new Set(['item-end-turn-heal', 'item-threshold-heal', 'item-survive-lethal-hit', 'item-resist-hit', 'item-status-cure', 'item-speed-boost', 'item-speed-modifier', 'item-accuracy-boost', 'item-accuracy-after-target', 'item-incoming-accuracy-modifier', 'item-critical-ratio', 'item-choice-lock', 'item-negative-stage-reset', 'item-healing-boost', 'item-terrain-seed', 'item-pp-restore', 'item-airborne', 'item-grounding', 'item-force-attacker-switch', 'item-holder-switch', 'item-binding-damage-boost', 'item-switch-escape', 'item-one-shot-damage-boost', 'item-species-stat-modifier', 'item-species-critical-ratio', 'item-consecutive-move-power', 'item-flinch-chance', 'item-volatile-cure', 'item-quick-order', ',']);

export function validatePassiveItemHandler(entry){
 if(!ITEM_HANDLER_IDS.has(entry.id))return null;
 const problems=[],params=entry.params||{};
 if(entry.id==='item-end-turn-heal'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('item-end-turn-heal requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='item-threshold-heal'){
  const tn=params.thresholdNumerator,td=params.thresholdDenominator;if(!Number.isInteger(tn)||!Number.isInteger(td)||tn<1||td<1||tn>td)problems.push('item-threshold-heal requires a valid threshold fraction');
  const hasFixed=Number.isInteger(params.healAmount)&&params.healAmount>0,hasFraction=Number.isInteger(params.healNumerator)&&Number.isInteger(params.healDenominator)&&params.healNumerator>=1&&params.healDenominator>=1&&params.healNumerator<=params.healDenominator;
  if(Number(hasFixed)+Number(hasFraction)!==1)problems.push('item-threshold-heal requires exactly one fixed healAmount or valid heal fraction');
  return problems;
 }
 if(entry.id==='item-survive-lethal-hit'){
  if(params.requireFullHp!==undefined&&typeof params.requireFullHp!=='boolean')problems.push('item-survive-lethal-hit requireFullHp must be boolean');
  if(params.consume!==undefined&&typeof params.consume!=='boolean')problems.push('item-survive-lethal-hit consume must be boolean');
  if(params.chance!==undefined&&(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1))problems.push('item-survive-lethal-hit chance must be in (0, 1]');
  return problems;
 }
 if(entry.id==='item-resist-hit'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('item-resist-hit requires a canonical type');
  if(params.requireSuperEffective!==undefined&&typeof params.requireSuperEffective!=='boolean')problems.push('item-resist-hit requireSuperEffective must be boolean');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('item-resist-hit requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='item-status-cure'){
  if(params.statuses!==undefined&&(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(status))))problems.push('item-status-cure statuses must contain distinct supported major statuses');
  if(params.confusion!==undefined&&typeof params.confusion!=='boolean')problems.push('item-status-cure confusion must be boolean');
  if(!params.confusion&&!(Array.isArray(params.statuses)&&params.statuses.length))problems.push('item-status-cure requires statuses and/or confusion');
  return problems;
 }
 if(['item-post-move-recoil','item-contact-retaliation','item-damage-heal'].includes(entry.id)){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push(`${entry.id} requires a valid positive fraction`);
  return problems;
 }
 if(entry.id==='item-speed-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-speed-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='item-speed-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('item-speed-modifier requires a positive non-1 multiplier');
  return problems;
 }
 if(entry.id==='item-accuracy-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-accuracy-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='item-accuracy-after-target'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-accuracy-after-target requires multiplier > 1');
  return problems;
 }
 if(entry.id==='item-incoming-accuracy-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('item-incoming-accuracy-modifier requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='item-critical-ratio'){
  if(!Number.isInteger(params.stages)||params.stages<1||params.stages>3)problems.push('item-critical-ratio requires stages from 1 to 3');
  return problems;
 }
 if(entry.id==='item-choice-lock')return problems;
 if(entry.id==='item-negative-stage-reset')return problems;
 if(entry.id==='item-healing-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-healing-boost requires multiplier > 1');
  if(!Array.isArray(params.sources)||!params.sources.length||new Set(params.sources).size!==params.sources.length||params.sources.some(source=>!['drain','leech-seed'].includes(source)))problems.push('item-healing-boost requires distinct supported healing sources');
  return problems;
 }
 if(entry.id==='item-terrain-seed'){
  if(!['electric','grassy','misty','psychic'].includes(params.terrain))problems.push('item-terrain-seed requires a supported terrain');
  if(!['def','spd'].includes(params.stat))problems.push('item-terrain-seed requires def or spd');
  if(!Number.isInteger(params.stages)||params.stages<1||params.stages>6)problems.push('item-terrain-seed requires stages from 1 to 6');
  return problems;
 }
 if(entry.id==='item-pp-restore'){
  if(!Number.isInteger(params.amount)||params.amount<1)problems.push('item-pp-restore requires positive amount');
  return problems;
 }
 if(entry.id==='item-airborne'){
  if(params.popOnDamage!==undefined&&typeof params.popOnDamage!=='boolean')problems.push('item-airborne popOnDamage must be boolean');
  return problems;
 }
 if(entry.id==='item-grounding')return problems;
 if(entry.id==='item-force-attacker-switch'||entry.id==='item-holder-switch')return problems;
 if(entry.id==='item-binding-damage-boost'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('item-binding-damage-boost requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='item-switch-escape')return problems;
 if(entry.id==='item-one-shot-damage-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('item-one-shot-damage-boost requires a canonical type');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-one-shot-damage-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='item-species-stat-modifier'){
  if(!Array.isArray(params.speciesIds)||!params.speciesIds.length||new Set(params.speciesIds).size!==params.speciesIds.length||params.speciesIds.some(id=>typeof id!=='string'||!id))problems.push('item-species-stat-modifier requires distinct speciesIds');
  if(!Array.isArray(params.stats)||!params.stats.length||new Set(params.stats).size!==params.stats.length||params.stats.some(stat=>!['atk','spa'].includes(stat)))problems.push('item-species-stat-modifier requires distinct atk/spa stats');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('item-species-stat-modifier requires a positive non-1 multiplier');
  return problems;
 }
 if(entry.id==='item-species-critical-ratio'){
  if(!Array.isArray(params.speciesIds)||!params.speciesIds.length||new Set(params.speciesIds).size!==params.speciesIds.length||params.speciesIds.some(id=>typeof id!=='string'||!id))problems.push('item-species-critical-ratio requires distinct speciesIds');
  if(!Number.isInteger(params.stages)||params.stages<1||params.stages>3)problems.push('item-species-critical-ratio requires stages from 1 to 3');
  return problems;
 }
 if(entry.id==='item-consecutive-move-power'){
  if(!Number.isFinite(params.increment)||params.increment<=0||params.increment>1)problems.push('item-consecutive-move-power requires increment in (0, 1]');
  if(!Number.isFinite(params.maxMultiplier)||params.maxMultiplier<=1)problems.push('item-consecutive-move-power requires maxMultiplier > 1');
  return problems;
 }
 if(entry.id==='item-flinch-chance'){
  if(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1)problems.push('item-flinch-chance requires chance in (0, 1]');
  return problems;
 }
 if(entry.id==='item-volatile-cure'){
  const allowed=['infatuation','taunt','torment','disable','heal-block','encore'];
  if(!Array.isArray(params.volatiles)||!params.volatiles.length||new Set(params.volatiles).size!==params.volatiles.length||params.volatiles.some(id=>!allowed.includes(id)))problems.push('item-volatile-cure requires distinct supported volatile ids');
  return problems;
 }
 if(entry.id==='item-quick-order'){
  if(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1)problems.push('item-quick-order requires chance in (0, 1]');
  return problems;
 }
 return problems;
}
