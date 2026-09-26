import {CANONICAL_TYPES} from '../../rules-v3/type-chart.mjs';

const SUPPORTED_WEATHERS=['sun','rain','snow','sandstorm'];
const HANDLER_IDS=new Set(['low-hp-type-boost', 'held-damage-boost', 'received-type-damage-reduction', 'weather-stat-boost', 'weather-residual-damage', 'weather-status-immunity', 'weather-type-damage-boost', 'field-type-damage-aura', 'weather-residual-immunity', 'weather-incoming-accuracy-modifier', 'volatile-incoming-accuracy-modifier', 'type-immunity-boost', 'type-immunity-response', 'status-type-immunity-bypass', 'priority-move-immunity-aura', 'ally-major-status-immunity', 'ally-stat-drop-immunity', 'ally-volatile-immunity', 'held-item-suppression', 'grounding-immunity', 'opponent-berry-suppression', 'move-type-conversion', 'effective-weather-override', 'outgoing-secondary-effect', 'turn-order-modifier', 'type-immunity-bypass', 'end-turn-berry-restore', 'end-turn-ally-status-cure', 'item-loss-speed-boost', 'received-type-damage-modifier', 'contact-response', 'damage-response', 'ko-stat-boost', 'end-turn-stat-boost', 'lethal-hit-survival', 'critical-damage-boost', 'base-power-threshold-boost', 'move-tag-power-boost', 'move-tag-immunity', 'remove-contact', 'secondary-effect-power-boost', 'stat-multiplier', 'gender-damage-modifier', 'weight-modifier', 'outgoing-accuracy-modifier', 'contact-power-boost', 'recoil-power-boost', 'major-status-immunity', 'critical-ratio', 'critical-immunity', 'recoil-immunity', 'stab-modifier', 'received-damage-modifier', 'always-hit', 'burn-attack-penalty-immunity']);

export function validatePassiveAbilityCoreHandler(entry){
 if(!HANDLER_IDS.has(entry.id))return null;
 const problems=[],params=entry.params||{};
 if(entry.id==='low-hp-type-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('low-hp-type-boost requires a canonical type');
  if(!Number.isInteger(params.hpDenominator)||params.hpDenominator<2)problems.push('low-hp-type-boost requires hpDenominator >= 2');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('low-hp-type-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='held-damage-boost'){
  const selectors=Number(CANONICAL_TYPES.includes(params.type))+Number(['physical','special'].includes(params.category))+Number(params.allDamaging===true)+Number(params.superEffective===true);if(selectors!==1)problems.push('held-damage-boost requires exactly one supported selector');
  if(params.allDamaging!==undefined&&typeof params.allDamaging!=='boolean')problems.push('held-damage-boost allDamaging must be boolean');
  if(params.superEffective!==undefined&&typeof params.superEffective!=='boolean')problems.push('held-damage-boost superEffective must be boolean');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('held-damage-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='received-type-damage-reduction'){
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('received-type-damage-reduction requires distinct canonical types');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('received-type-damage-reduction requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='weather-stat-boost'){
  if(!['atk','spa'].includes(params.stat))problems.push('weather-stat-boost requires atk or spa');
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-stat-boost requires supported weather');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('weather-stat-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='weather-residual-damage'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-residual-damage requires supported weather');
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('weather-residual-damage requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='weather-status-immunity'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-status-immunity requires supported weather');
  if(!Array.isArray(params.statuses)||!params.statuses.length)problems.push('weather-status-immunity requires statuses');
  return problems;
 }
 if(entry.id==='weather-type-damage-boost'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-type-damage-boost requires supported weather');
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('weather-type-damage-boost requires distinct canonical types');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('weather-type-damage-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='field-type-damage-aura'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('field-type-damage-aura requires a canonical type');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('field-type-damage-aura requires multiplier > 1');
  return problems;
 }
 if(entry.id==='weather-residual-immunity'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-residual-immunity requires supported weather');
  return problems;
 }
 if(entry.id==='weather-incoming-accuracy-modifier'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('weather-incoming-accuracy-modifier requires supported weather');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('weather-incoming-accuracy-modifier requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='volatile-incoming-accuracy-modifier'){
  if(!['confusion','flinch','taunt','encore','disable','leech-seed'].includes(params.volatile))problems.push('volatile-incoming-accuracy-modifier requires a supported volatile');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('volatile-incoming-accuracy-modifier requires multiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='type-immunity-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('type-immunity-boost requires a canonical type');
  if(typeof params.stateKey!=='string'||!params.stateKey)problems.push('type-immunity-boost requires stateKey');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('type-immunity-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='type-immunity-response'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('type-immunity-response requires a canonical type');
  if(!['heal','stat'].includes(params.response))problems.push('type-immunity-response requires heal or stat response');
  if(params.response==='heal'){
   if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('type-immunity-response heal requires a valid positive fraction');
  }
  if(params.response==='stat'){
   if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(params.stat))problems.push('type-immunity-response stat requires a battle stage');
   if(!Number.isInteger(params.stages)||params.stages<1||params.stages>6)problems.push('type-immunity-response stat requires stages from 1 to 6');
  }
  return problems;
 }
 if(entry.id==='status-type-immunity-bypass'){
  const allowed=['burn','paralysis','poison','sleep','freeze','bad-poison'];
  if(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!allowed.includes(status)))problems.push('status-type-immunity-bypass requires distinct supported statuses');
  if(!Array.isArray(params.targetTypes)||!params.targetTypes.length||new Set(params.targetTypes).size!==params.targetTypes.length||params.targetTypes.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('status-type-immunity-bypass requires distinct canonical targetTypes');
  return problems;
 }
 if(entry.id==='priority-move-immunity-aura')return problems;
 if(entry.id==='ally-major-status-immunity'){
  const allowed=['burn','paralysis','poison','sleep','freeze','bad-poison'];
  if(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!allowed.includes(status)))problems.push('ally-major-status-immunity requires distinct supported statuses');
  if(params.targetTypes!==undefined&&(!Array.isArray(params.targetTypes)||!params.targetTypes.length||new Set(params.targetTypes).size!==params.targetTypes.length||params.targetTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('ally-major-status-immunity targetTypes must be distinct canonical types');
  if(params.otherPokemonOnly!==undefined&&typeof params.otherPokemonOnly!=='boolean')problems.push('ally-major-status-immunity otherPokemonOnly must be boolean');
  return problems;
 }
 if(entry.id==='ally-stat-drop-immunity'){
  if(params.targetTypes!==undefined&&(!Array.isArray(params.targetTypes)||!params.targetTypes.length||new Set(params.targetTypes).size!==params.targetTypes.length||params.targetTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('ally-stat-drop-immunity targetTypes must be distinct canonical types');
  return problems;
 }
 if(entry.id==='ally-volatile-immunity'){
  const allowed=['confusion','flinch','taunt','encore','disable','leech-seed','torment'];
  if(!Array.isArray(params.volatiles)||!params.volatiles.length||new Set(params.volatiles).size!==params.volatiles.length||params.volatiles.some(id=>!allowed.includes(id)))problems.push('ally-volatile-immunity requires distinct supported volatiles');
  return problems;
 }
 if(entry.id==='held-item-suppression'||entry.id==='grounding-immunity'||entry.id==='opponent-berry-suppression')return problems;
 if(entry.id==='move-type-conversion'){
  if(!CANONICAL_TYPES.includes(params.fromType)||!CANONICAL_TYPES.includes(params.toType)||params.fromType===params.toType)problems.push('move-type-conversion requires distinct canonical fromType/toType');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('move-type-conversion requires multiplier > 1');
  return problems;
 }
 if(entry.id==='effective-weather-override'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('effective-weather-override requires supported weather');
  return problems;
 }
 if(entry.id==='outgoing-secondary-effect'){
  if(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1)problems.push('outgoing-secondary-effect requires chance in (0, 1]');
  const responses=Number(typeof params.status==='string')+Number(typeof params.volatile==='string');if(responses!==1)problems.push('outgoing-secondary-effect requires exactly one status or volatile');
  if(params.status!==undefined&&!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(params.status))problems.push('outgoing-secondary-effect status must be supported');
  if(params.volatile!==undefined&&!['confusion','flinch','taunt','encore','disable','leech-seed'].includes(params.volatile))problems.push('outgoing-secondary-effect volatile must be supported');
  if(params.contactOnly!==undefined&&typeof params.contactOnly!=='boolean')problems.push('outgoing-secondary-effect contactOnly must be boolean');
  if(params.skipIfMoveAlreadyHas!==undefined&&!['flinch'].includes(params.skipIfMoveAlreadyHas))problems.push('outgoing-secondary-effect skipIfMoveAlreadyHas must be supported');
  return problems;
 }
 if(entry.id==='turn-order-modifier'){
  if(params.priorityDelta!==undefined&&(!Number.isInteger(params.priorityDelta)||params.priorityDelta===0))problems.push('turn-order-modifier priorityDelta must be a non-zero integer');
  if(params.orderBoost!==undefined&&(!Number.isInteger(params.orderBoost)||params.orderBoost===0))problems.push('turn-order-modifier orderBoost must be a non-zero integer');
  if(params.priorityDelta===undefined&&params.orderBoost===undefined)problems.push('turn-order-modifier requires priorityDelta and/or orderBoost');
  if(params.chance!==undefined&&(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1))problems.push('turn-order-modifier chance must be in (0, 1]');
  if(params.types!==undefined&&(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('turn-order-modifier types must be distinct canonical types');
  if(params.categories!==undefined&&(!Array.isArray(params.categories)||!params.categories.length||params.categories.some(category=>!['physical','special','status'].includes(category))))problems.push('turn-order-modifier categories must be supported');
  if(params.blockedTargetTypes!==undefined&&(!Array.isArray(params.blockedTargetTypes)||!params.blockedTargetTypes.length||params.blockedTargetTypes.some(type=>!CANONICAL_TYPES.includes(type))))problems.push('turn-order-modifier blockedTargetTypes must be canonical');
  if(params.requireFullHp!==undefined&&typeof params.requireFullHp!=='boolean')problems.push('turn-order-modifier requireFullHp must be boolean');
  return problems;
 }
 if(entry.id==='type-immunity-bypass'){
  if(!Array.isArray(params.attackTypes)||!params.attackTypes.length||params.attackTypes.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('type-immunity-bypass requires canonical attackTypes');
  if(!Array.isArray(params.targetTypes)||!params.targetTypes.length||params.targetTypes.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('type-immunity-bypass requires canonical targetTypes');
  return problems;
 }
 if(entry.id==='end-turn-berry-restore'||entry.id==='end-turn-ally-status-cure'){
  if(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1)problems.push(`${entry.id} requires chance in (0, 1]`);
  if(entry.id==='end-turn-berry-restore'&&params.weatherGuarantee!==undefined&&!SUPPORTED_WEATHERS.includes(params.weatherGuarantee))problems.push('end-turn-berry-restore weatherGuarantee must be supported');
  return problems;
 }
 if(entry.id==='item-loss-speed-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('item-loss-speed-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='received-type-damage-modifier'){
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('received-type-damage-modifier requires distinct canonical types');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('received-type-damage-modifier requires a positive non-1 multiplier');
  return problems;
 }
 if(entry.id==='contact-response'){
  if(!['damage','status','stat','volatile'].includes(params.response))problems.push('contact-response requires damage, status, stat, or volatile response');
  if(params.chance!==undefined&&(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1))problems.push('contact-response chance must be in (0, 1]');
  if(params.requireHolderFainted!==undefined&&typeof params.requireHolderFainted!=='boolean')problems.push('contact-response requireHolderFainted must be boolean');
  if(params.response==='damage'&&(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator))problems.push('contact-response damage requires a valid positive fraction');
  if(params.response==='status'&&!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(params.status))problems.push('contact-response status requires a supported major status');
  if(params.response==='volatile'&&params.volatile!=='infatuation')problems.push('contact-response volatile currently requires infatuation');
  if(params.response==='stat'){
   if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(params.stat))problems.push('contact-response stat requires a battle stage');
   if(!Number.isInteger(params.stages)||params.stages===0||params.stages<-6||params.stages>6)problems.push('contact-response stat requires non-zero stages from -6 to 6');
  }
  return problems;
 }
 if(entry.id==='damage-response'){
  if(params.requireCritical!==undefined&&typeof params.requireCritical!=='boolean')problems.push('damage-response requireCritical must be boolean');
  if(params.moveType!==undefined&&!CANONICAL_TYPES.includes(params.moveType))problems.push('damage-response moveType must be canonical');
  if(params.category!==undefined&&!['physical','special'].includes(params.category))problems.push('damage-response category must be physical or special');
  if(params.thresholdCross!==undefined){const value=params.thresholdCross;if(!value||!Number.isInteger(value.numerator)||!Number.isInteger(value.denominator)||value.numerator<1||value.denominator<1||value.numerator>value.denominator)problems.push('damage-response thresholdCross requires a valid positive fraction');}
  const responses=[params.boosts!==undefined,params.setStages!==undefined,params.weather!==undefined,params.hazard!==undefined,params.attackerStatus!==undefined,params.faintAttackerDamage!==undefined].filter(Boolean).length;if(responses!==1)problems.push('damage-response requires exactly one response');
  for(const field of ['boosts','setStages'])if(params[field]!==undefined){const entries=params[field]&&typeof params[field]==='object'&&!Array.isArray(params[field])?Object.entries(params[field]):[];if(!entries.length)problems.push(`damage-response ${field} requires stages`);for(const [stat,value] of entries){if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(stat))problems.push(`damage-response ${field} has unsupported stat`);if(!Number.isInteger(value)||value<-6||value>6||(field==='boosts'&&value===0))problems.push(`damage-response ${field} has invalid stage value`);}}
  if(params.weather!==undefined&&!SUPPORTED_WEATHERS.includes(params.weather))problems.push('damage-response weather must be supported');
  if(params.hazard!==undefined&&!['stealth-rock','spikes','toxic-spikes'].includes(params.hazard))problems.push('damage-response hazard must be supported');
  if(params.attackerStatus!==undefined&&!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(params.attackerStatus))problems.push('damage-response attackerStatus must be supported');
  if(params.faintAttackerDamage!==undefined&&params.faintAttackerDamage!=='hp-before')problems.push('damage-response faintAttackerDamage must be hp-before');
  return problems;
 }
 if(entry.id==='ko-stat-boost'||entry.id==='end-turn-stat-boost'){
  if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(params.stat))problems.push(`${entry.id} requires a battle stage`);
  if(!Number.isInteger(params.stages)||params.stages===0||params.stages<-6||params.stages>6)problems.push(`${entry.id} requires non-zero stages from -6 to 6`);
  if(entry.id==='end-turn-stat-boost'&&params.skipEntryTurn!==undefined&&typeof params.skipEntryTurn!=='boolean')problems.push('end-turn-stat-boost skipEntryTurn must be boolean');
  return problems;
 }
 if(entry.id==='lethal-hit-survival'){
  if(params.requireFullHp!==undefined&&typeof params.requireFullHp!=='boolean')problems.push('lethal-hit-survival requireFullHp must be boolean');
  if(params.blocksOhko!==undefined&&typeof params.blocksOhko!=='boolean')problems.push('lethal-hit-survival blocksOhko must be boolean');
  return problems;
 }
 if(entry.id==='critical-damage-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('critical-damage-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='base-power-threshold-boost'){
  if(!Number.isInteger(params.maxPower)||params.maxPower<1)problems.push('base-power-threshold-boost requires positive maxPower');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('base-power-threshold-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='move-tag-power-boost'){
  if(typeof params.tag!=='string'||!params.tag)problems.push('move-tag-power-boost requires tag');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('move-tag-power-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='move-tag-immunity'){
  if(typeof params.tag!=='string'||!params.tag)problems.push('move-tag-immunity requires tag');
  return problems;
 }
 if(entry.id==='remove-contact')return problems;

 if(entry.id==='secondary-effect-power-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('secondary-effect-power-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='stat-multiplier'){
  if(!['atk','def','spa','spd','spe'].includes(params.stat))problems.push('stat-multiplier requires a supported stat');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('stat-multiplier requires a positive non-1 multiplier');
  if(params.requireStatus!==undefined&&typeof params.requireStatus!=='boolean')problems.push('stat-multiplier requireStatus must be boolean');
  if(params.terrain!==undefined&&!['electric','grassy','misty','psychic'].includes(params.terrain))problems.push('stat-multiplier terrain must be a supported terrain');
  return problems;
 }
 if(entry.id==='gender-damage-modifier'){
  if(!Number.isFinite(params.sameGenderMultiplier)||params.sameGenderMultiplier<=1)problems.push('gender-damage-modifier requires sameGenderMultiplier > 1');
  if(!Number.isFinite(params.oppositeGenderMultiplier)||params.oppositeGenderMultiplier<=0||params.oppositeGenderMultiplier>=1)problems.push('gender-damage-modifier requires oppositeGenderMultiplier between 0 and 1');
  return problems;
 }
 if(entry.id==='weight-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('weight-modifier requires a positive non-1 multiplier');
  return problems;
 }
 if(entry.id==='outgoing-accuracy-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0)problems.push('outgoing-accuracy-modifier requires multiplier > 0');
  if(params.category!==undefined&&!['physical','special'].includes(params.category))problems.push('outgoing-accuracy-modifier category must be physical or special');
  return problems;
 }
 if(entry.id==='contact-power-boost'||entry.id==='recoil-power-boost'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push(`${entry.id} requires multiplier > 1`);
  return problems;
 }
 if(entry.id==='major-status-immunity'){
  const allowed=['burn','paralysis','poison','sleep','freeze','bad-poison'];
  if(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!allowed.includes(status)))problems.push('major-status-immunity requires distinct supported statuses');
  return problems;
 }
 if(entry.id==='critical-ratio'){
  if(!Number.isInteger(params.stages)||params.stages<1||params.stages>3)problems.push('critical-ratio requires stages from 1 to 3');
  return problems;
 }
 if(entry.id==='critical-immunity'||entry.id==='recoil-immunity')return problems;
 if(entry.id==='stab-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('stab-modifier requires multiplier > 1');
  return problems;
 }

 if(entry.id==='received-damage-modifier'){
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('received-damage-modifier requires multiplier between 0 and 1');
  if(params.requireFullHp!==undefined&&typeof params.requireFullHp!=='boolean')problems.push('received-damage-modifier requireFullHp must be boolean');
  if(params.superEffective!==undefined&&typeof params.superEffective!=='boolean')problems.push('received-damage-modifier superEffective must be boolean');
  if(params.requireContact!==undefined&&typeof params.requireContact!=='boolean')problems.push('received-damage-modifier requireContact must be boolean');
  if(params.requireFullHp!==true&&params.superEffective!==true&&params.requireContact!==true)problems.push('received-damage-modifier requires a supported condition');
  return problems;
 }
 if(entry.id==='always-hit'||entry.id==='burn-attack-penalty-immunity')return problems;

 return problems;
}
