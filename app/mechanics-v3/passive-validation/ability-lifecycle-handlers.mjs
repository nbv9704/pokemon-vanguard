import {CANONICAL_TYPES} from '../../rules-v3/type-chart.mjs';

const SUPPORTED_WEATHERS=['sun','rain','snow','sandstorm'];
const HANDLER_IDS=new Set(['stat-drop-immunity', 'stat-drop-response', 'volatile-immunity', 'critical-vs-status', 'status-residual-heal', 'status-reflect', 'flinch-stat-boost', 'ally-damage-immunity', 'secondary-effect-immunity', 'multi-hit-max', 'paralysis-speed-penalty-immunity', 'ally-damage-reduction', 'ally-ability-stat-multiplier', 'weather-status-cure', 'switch-out-status-cure', 'entry-screen-cleaner', 'entry-ally-stage-reset', 'switch-out-heal', 'random-status-cure', 'contact-protection-pierce', 'parental-bond', 'opponent-switch-trap', 'entry-weather', 'entry-terrain', 'entry-stat-drop', 'entry-ally-heal', 'late-move-power-boost', 'berry-consumption-heal', 'weather-suppression', 'entry-item-reveal', 'stat-drop-reflect', 'target-pp-pressure', 'redirection-bypass', 'damage-response-disable', 'sleep-counter-rate', 'damage-charge-type', 'end-turn-random-stat-shift', 'redirection-immunity', 'pre-move-type-change', 'entry-fainted-ally-power-boost', 'stat-change-inversion', 'opponent-stat-gain-copy', 'stat-change-multiplier', 'global-move-block', 'type-redirection', 'side-condition-bypass', 'berry-effect-multiplier', 'opponent-stage-ignore', 'field-type-change', 'disguise-shield', 'stance-form-change', 'end-turn-form-toggle', 'switch-out-form-change', 'contact-ability-replace', 'berry-threshold-modifier', 'berry-replay', 'item-steal-on-hit', 'item-steal-on-contact', 'end-turn-item-pickup', 'held-item-removal-immunity', 'ally-item-pass', 'entry-ability-copy', 'ally-faint-ability-copy', 'contact-ability-swap', 'indirect-damage-immunity', 'entry-danger-sense', 'opponent-ability-bypass', 'status-move-reflect', 'entry-transform', 'entry-illusion']);

export function validatePassiveAbilityLifecycleHandler(entry){
 if(!HANDLER_IDS.has(entry.id))return null;
 const problems=[],params=entry.params||{};
 if(entry.id==='stat-drop-immunity'){
  if(params.stats!==undefined&&(!Array.isArray(params.stats)||!params.stats.length||new Set(params.stats).size!==params.stats.length||params.stats.some(stat=>!['atk','def','spa','spd','spe','accuracy','evasion'].includes(stat))))problems.push('stat-drop-immunity stats must be distinct supported stages');
  if(params.sourceAbilities!==undefined&&(!Array.isArray(params.sourceAbilities)||!params.sourceAbilities.length||new Set(params.sourceAbilities).size!==params.sourceAbilities.length||params.sourceAbilities.some(id=>typeof id!=='string'||!id)))problems.push('stat-drop-immunity sourceAbilities must be distinct non-empty ids');
  return problems;
 }
 if(entry.id==='stat-drop-response'){
  const boosts=params.boosts;
  if(!boosts||typeof boosts!=='object'||Array.isArray(boosts)||!Object.keys(boosts).length||Object.entries(boosts).some(([stat,delta])=>!['atk','def','spa','spd','spe','accuracy','evasion'].includes(stat)||!Number.isInteger(delta)||delta<=0||delta>6))problems.push('stat-drop-response boosts must contain positive supported stages');
  return problems;
 }
 if(entry.id==='volatile-immunity'){
  if(!Array.isArray(params.volatiles)||!params.volatiles.length||new Set(params.volatiles).size!==params.volatiles.length||params.volatiles.some(id=>!['confusion','flinch','taunt','encore','disable','leech-seed','infatuation'].includes(id)))problems.push('volatile-immunity requires distinct supported volatiles');
  return problems;
 }
 if(entry.id==='critical-vs-status'||entry.id==='status-residual-heal'||entry.id==='status-reflect'){
  const allowed=['burn','paralysis','poison','sleep','freeze','bad-poison'];
  if(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!allowed.includes(status)))problems.push(`${entry.id} requires distinct supported statuses`);
  if(entry.id==='status-residual-heal'&&(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator))problems.push('status-residual-heal requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='flinch-stat-boost'){
  if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(params.stat))problems.push('flinch-stat-boost requires a supported stat');
  if(!Number.isInteger(params.stages)||params.stages<1||params.stages>6)problems.push('flinch-stat-boost requires positive stages');
  return problems;
 }
 if(entry.id==='ally-damage-immunity'||entry.id==='secondary-effect-immunity'||entry.id==='multi-hit-max'||entry.id==='paralysis-speed-penalty-immunity')return problems;
 if(entry.id==='ally-damage-reduction'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('ally-damage-reduction requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='ally-ability-stat-multiplier'){
  if(!['atk','def','spa','spd','spe'].includes(params.stat))problems.push('ally-ability-stat-multiplier requires a supported stat');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('ally-ability-stat-multiplier requires multiplier > 1');
  if(!Array.isArray(params.allyAbilities)||!params.allyAbilities.length||new Set(params.allyAbilities).size!==params.allyAbilities.length)problems.push('ally-ability-stat-multiplier requires distinct allyAbilities');
  return problems;
 }
 if(entry.id==='weather-status-cure'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-status-cure requires supported weather');
  return problems;
 }
 if(entry.id==='switch-out-status-cure'||entry.id==='entry-screen-cleaner'||entry.id==='entry-ally-stage-reset')return problems;
 if(entry.id==='switch-out-heal'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('switch-out-heal requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='random-status-cure'){
  if(!Number.isInteger(params.chanceNumerator)||!Number.isInteger(params.chanceDenominator)||params.chanceNumerator<1||params.chanceDenominator<1||params.chanceNumerator>params.chanceDenominator)problems.push('random-status-cure requires a valid chance fraction');
  return problems;
 }
 if(entry.id==='contact-protection-pierce'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('contact-protection-pierce requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='parental-bond'){
  if(!Number.isFinite(params.secondHitMultiplier)||params.secondHitMultiplier<=0||params.secondHitMultiplier>=1)problems.push('parental-bond requires secondHitMultiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='opponent-switch-trap'){
  if(params.exemptTypes!==undefined&&(!Array.isArray(params.exemptTypes)||new Set(params.exemptTypes).size!==params.exemptTypes.length||params.exemptTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('opponent-switch-trap exemptTypes must contain distinct canonical types');
  if(params.exemptSameAbility!==undefined&&typeof params.exemptSameAbility!=='boolean')problems.push('opponent-switch-trap exemptSameAbility must be boolean');
  return problems;
 }
 if(entry.id==='entry-weather'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('entry-weather requires supported weather');
  if(!Number.isInteger(params.turns)||params.turns<1)problems.push('entry-weather requires positive turns');
  return problems;
 }
 if(entry.id==='entry-terrain'){
  if(!['electric','grassy','psychic','misty'].includes(params.terrain))problems.push('entry-terrain requires supported terrain');
  if(!Number.isInteger(params.turns)||params.turns<1)problems.push('entry-terrain requires positive turns');
  return problems;
 }
 if(entry.id==='entry-stat-drop'){
  if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(params.stat))problems.push('entry-stat-drop requires a supported stat');
  if(!Number.isInteger(params.stages)||params.stages>=0)problems.push('entry-stat-drop requires negative integer stages');
  if(params.scope!=='opponents')problems.push('entry-stat-drop currently requires opponents scope');
  if(params.oncePerBattle!==undefined&&typeof params.oncePerBattle!=='boolean')problems.push('entry-stat-drop oncePerBattle must be boolean');
  return problems;
 }
 if(entry.id==='entry-ally-heal'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('entry-ally-heal requires a valid positive fraction');
  return problems;
 }



 if(entry.id==='late-move-power-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('late-move-power-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='berry-consumption-heal'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('berry-consumption-heal requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='weather-suppression'||entry.id==='entry-item-reveal'||entry.id==='stat-drop-reflect'||entry.id==='target-pp-pressure'||entry.id==='redirection-bypass')return problems;
 if(entry.id==='damage-response-disable'){
  if(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1)problems.push('damage-response-disable requires chance in (0, 1]');
  return problems;
 }
 if(entry.id==='sleep-counter-rate'){
  if(!Number.isInteger(params.rate)||params.rate<2)problems.push('sleep-counter-rate requires integer rate >= 2');
  return problems;
 }
 if(entry.id==='damage-charge-type'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('damage-charge-type requires a canonical type');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('damage-charge-type requires multiplier > 1');
  return problems;
 }
 if(entry.id==='end-turn-random-stat-shift'){
  if(!Array.isArray(params.stats)||params.stats.length<2||new Set(params.stats).size!==params.stats.length||params.stats.some(stat=>!['atk','def','spa','spd','spe'].includes(stat)))problems.push('end-turn-random-stat-shift requires distinct combat stats');
  if(!Number.isInteger(params.raise)||params.raise<1||params.raise>6||!Number.isInteger(params.lower)||params.lower>-1||params.lower<-6)problems.push('end-turn-random-stat-shift requires positive raise and negative lower stages');
  return problems;
 }
 if(entry.id==='redirection-immunity'){
  if(!Array.isArray(params.kinds)||!params.kinds.length||new Set(params.kinds).size!==params.kinds.length||params.kinds.some(kind=>!['rage-powder','follow-me'].includes(kind)))problems.push('redirection-immunity requires distinct supported kinds');
  return problems;
 }
 if(entry.id==='pre-move-type-change'){
  if(params.oncePerSwitch!==true)problems.push('pre-move-type-change currently requires oncePerSwitch true');
  return problems;
 }
 if(entry.id==='entry-fainted-ally-power-boost'){
  if(!Number.isFinite(params.increment)||params.increment<=0||params.increment>1)problems.push('entry-fainted-ally-power-boost requires increment in (0, 1]');
  if(!Number.isInteger(params.maxCount)||params.maxCount<1||params.maxCount>6)problems.push('entry-fainted-ally-power-boost requires maxCount from 1 to 6');
  return problems;
 }
 if(entry.id==='stat-change-inversion'||entry.id==='opponent-stat-gain-copy')return problems;
 if(entry.id==='stat-change-multiplier'){if(!Number.isInteger(params.multiplier)||params.multiplier<2||params.multiplier>6)problems.push('stat-change-multiplier requires integer multiplier from 2 to 6');return problems;}
 if(entry.id==='global-move-block'){
  if(!Array.isArray(params.moveIds)||!params.moveIds.length||new Set(params.moveIds).size!==params.moveIds.length||params.moveIds.some(id=>typeof id!=='string'||!id))problems.push('global-move-block requires distinct moveIds');
  if(params.blockContactFaintResponse!==undefined&&typeof params.blockContactFaintResponse!=='boolean')problems.push('global-move-block blockContactFaintResponse must be boolean');
  return problems;
 }
 if(entry.id==='type-redirection'){
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('type-redirection requires distinct canonical types');
  return problems;
 }
 if(entry.id==='side-condition-bypass'){
  if(!Array.isArray(params.conditions)||!params.conditions.length||new Set(params.conditions).size!==params.conditions.length||params.conditions.some(condition=>!['reflect','light-screen','aurora-veil','safeguard','substitute'].includes(condition)))problems.push('side-condition-bypass requires distinct supported conditions');
  return problems;
 }
 if(entry.id==='berry-effect-multiplier'){
  if(!Number.isInteger(params.multiplier)||params.multiplier<2||params.multiplier>4)problems.push('berry-effect-multiplier requires integer multiplier from 2 to 4');
  return problems;
 }
 if(entry.id==='opponent-stage-ignore'){
  const allowed=['atk','def','spa','spd','spe','accuracy','evasion'];
  for(const key of ['whenAttacking','whenDefending'])if(params[key]!==undefined&&(!Array.isArray(params[key])||!params[key].length||new Set(params[key]).size!==params[key].length||params[key].some(stat=>!allowed.includes(stat))))problems.push(`opponent-stage-ignore ${key} requires distinct supported stages`);
  if(!Array.isArray(params.whenAttacking)&&!Array.isArray(params.whenDefending))problems.push('opponent-stage-ignore requires attacking and/or defending stages');
  return problems;
 }
 if(['berry-replay','item-steal-on-hit','item-steal-on-contact','end-turn-item-pickup','held-item-removal-immunity','ally-item-pass','entry-ability-copy','ally-faint-ability-copy','contact-ability-swap'].includes(entry.id))return problems;
 if(['indirect-damage-immunity','entry-danger-sense','opponent-ability-bypass','status-move-reflect'].includes(entry.id))return problems;
 if(entry.id==='field-type-change'){
  if(!['weather','terrain'].includes(params.field))problems.push('field-type-change requires weather or terrain field');
  const mappings=params.types&&typeof params.types==='object'&&!Array.isArray(params.types)?Object.entries(params.types):[];
  if(!mappings.length||mappings.some(([,type])=>!CANONICAL_TYPES.includes(type)))problems.push('field-type-change requires canonical type mappings');
  if(params.defaultTypes!==undefined&&(!Array.isArray(params.defaultTypes)||!params.defaultTypes.length||params.defaultTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('field-type-change defaultTypes must contain canonical types');
  return problems;
 }
 if(entry.id==='disguise-shield'){
  if(!Number.isInteger(params.breakNumerator)||!Number.isInteger(params.breakDenominator)||params.breakNumerator<0||params.breakDenominator<1||params.breakNumerator>params.breakDenominator)problems.push('disguise-shield requires a valid break damage fraction');
  return problems;
 }
 if(entry.id==='stance-form-change'){
  for(const key of ['attackForm','shieldForm']){const form=params[key];if(!form||typeof form!=='object'||typeof form.speciesId!=='string'||!form.speciesId||!form.baseStats||['hp','atk','def','spa','spd','spe'].some(stat=>!Number.isInteger(form.baseStats?.[stat])||form.baseStats[stat]<1))problems.push(`stance-form-change ${key} requires speciesId and complete baseStats`);}
  if(!Array.isArray(params.shieldMoveIds)||!params.shieldMoveIds.length||params.shieldMoveIds.some(id=>typeof id!=='string'||!id))problems.push('stance-form-change requires shieldMoveIds');
  return problems;
 }
 if(['entry-transform','entry-illusion'].includes(entry.id))return problems;
 if(entry.id==='end-turn-form-toggle'){
  const forms=params.forms&&typeof params.forms==='object'&&!Array.isArray(params.forms)?Object.entries(params.forms):[];if(forms.length<2)problems.push('end-turn-form-toggle requires at least two form mappings');
  for(const [,form] of forms)if(!form||typeof form.speciesId!=='string'||!form.speciesId||!form.baseStats||['hp','atk','def','spa','spd','spe'].some(stat=>!Number.isInteger(form.baseStats?.[stat])||form.baseStats[stat]<1))problems.push('end-turn-form-toggle mappings require speciesId and complete baseStats');
  return problems;
 }
 if(entry.id==='switch-out-form-change'){
  const form=params.form;if(!form||typeof form.speciesId!=='string'||!form.speciesId||!form.baseStats||['hp','atk','def','spa','spd','spe'].some(stat=>!Number.isInteger(form.baseStats?.[stat])||form.baseStats[stat]<1))problems.push('switch-out-form-change requires form with speciesId and complete baseStats');
  if(params.fromSpeciesIds!==undefined&&(!Array.isArray(params.fromSpeciesIds)||!params.fromSpeciesIds.length||params.fromSpeciesIds.some(id=>typeof id!=='string'||!id)))problems.push('switch-out-form-change fromSpeciesIds must contain species IDs');
  return problems;
 }
 if(entry.id==='contact-ability-replace'){if(params.replacementAbilityId!==undefined&&(typeof params.replacementAbilityId!=='string'||!params.replacementAbilityId))problems.push('contact-ability-replace replacementAbilityId must be a non-empty string');return problems;}
 if(entry.id==='berry-threshold-modifier'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('berry-threshold-modifier requires a valid threshold fraction');
  return problems;
 }
 return problems;
}
