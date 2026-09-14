import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {roomActive} from './rooms.mjs';
import {heldItemEffectActive} from './item-hooks.mjs';

export function compilePassiveEffects({abilityId=null,itemId=null,manifests}){
 const effects=[];for(const [sourceKind,sourceId] of [['ability',abilityId],['item',itemId]]){
  if(!sourceId||sourceId==='none')continue;const manifest=manifests?.[sourceKind==='ability'?'abilities':'items']?.[sourceId];
  if(!manifest)throw new Error(`unsupported ${sourceKind}: ${sourceId}`);
  for(const handler of manifest.handlers||[])if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-speed','weather-duration','weather-heal','screen-duration','terrain-duration','weather-stat-boost','weather-residual-damage','weather-status-immunity','type-immunity-boost','critical-damage-boost','base-power-threshold-boost','move-tag-power-boost','move-tag-immunity','remove-contact','move-type-by-tag','secondary-effect-power-boost','item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-status-cure'].includes(handler.id))effects.push({sourceKind,sourceId,kind:handler.id,order:handler.order,...handler.params});
 }
 return effects.sort((a,b)=>a.order-b.order||a.sourceKind.localeCompare(b.sourceKind)||a.sourceId.localeCompare(b.sourceId));
}

export function passiveEffectActive(effect,battle,unit=null){
 if(effect?.sourceKind!=='item')return true;
 if(unit)return heldItemEffectActive(unit,effect,battle);
 return !roomActive(battle,'magic-room');
}

export function receivedDamageModifiers(unit,move,battle){
 const applied=(unit?.passiveEffects||[]).filter(effect=>passiveEffectActive(effect,battle,unit)&&effect.kind==='received-type-damage-reduction'&&effect.types.includes(move.type));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

export function passiveDamageModifiers(unit,move,battle,{critical=false}={}){
 const applied=[];for(const effect of unit?.passiveEffects||[]){
  if(!passiveEffectActive(effect,battle,unit))continue;
  if(effect.kind==='low-hp-type-boost'&&move.type===effect.type&&unit.hp*effect.hpDenominator<=unit.maxHp)applied.push(effect);
  if(effect.kind==='held-damage-boost'&&(!effect.type||move.type===effect.type)&&(!effect.category||move.category===effect.category))applied.push(effect);
  if(effect.kind==='critical-damage-boost'&&critical)applied.push(effect);
 }
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

export function validatePassiveHandler(entry){
 const problems=[],params=entry.params||{};
 if(entry.id==='low-hp-type-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('low-hp-type-boost requires a canonical type');
  if(!Number.isInteger(params.hpDenominator)||params.hpDenominator<2)problems.push('low-hp-type-boost requires hpDenominator >= 2');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('low-hp-type-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='held-damage-boost'){
  const selectors=Number(CANONICAL_TYPES.includes(params.type))+Number(['physical','special'].includes(params.category));if(selectors!==1)problems.push('held-damage-boost requires exactly one supported selector');
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
  if(!['sun','rain'].includes(params.weather))problems.push('weather-stat-boost requires supported weather');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('weather-stat-boost requires multiplier > 1');
  return problems;
 }
 if(entry.id==='weather-residual-damage'){
  if(!['sun','rain'].includes(params.weather))problems.push('weather-residual-damage requires supported weather');
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('weather-residual-damage requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='weather-status-immunity'){
  if(!['sun','rain'].includes(params.weather))problems.push('weather-status-immunity requires supported weather');
  if(!Array.isArray(params.statuses)||!params.statuses.length)problems.push('weather-status-immunity requires statuses');
  return problems;
 }
 if(entry.id==='type-immunity-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('type-immunity-boost requires a canonical type');
  if(typeof params.stateKey!=='string'||!params.stateKey)problems.push('type-immunity-boost requires stateKey');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push('type-immunity-boost requires multiplier > 1');
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

 if(entry.id==='item-end-turn-heal'){
  if(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator)problems.push('item-end-turn-heal requires a valid positive fraction');
  return problems;
 }
 if(entry.id==='item-threshold-heal'){
  for(const [name,numerator,denominator] of [['threshold',params.thresholdNumerator,params.thresholdDenominator],['heal',params.healNumerator,params.healDenominator]])if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||numerator<1||denominator<1||numerator>denominator)problems.push(`item-threshold-heal requires a valid ${name} fraction`);
  return problems;
 }
 if(entry.id==='item-survive-lethal-hit'){
  if(params.requireFullHp!==undefined&&typeof params.requireFullHp!=='boolean')problems.push('item-survive-lethal-hit requireFullHp must be boolean');
  return problems;
 }
 if(entry.id==='item-status-cure'){
  if(params.statuses!==undefined&&(!Array.isArray(params.statuses)||!params.statuses.length||new Set(params.statuses).size!==params.statuses.length||params.statuses.some(status=>!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(status))))problems.push('item-status-cure statuses must contain distinct supported major statuses');
  if(params.confusion!==undefined&&typeof params.confusion!=='boolean')problems.push('item-status-cure confusion must be boolean');
  if(!params.confusion&&!(Array.isArray(params.statuses)&&params.statuses.length))problems.push('item-status-cure requires statuses and/or confusion');
  return problems;
 }
 if(entry.id==='move-type-by-tag'){
  if(typeof params.tag!=='string'||!params.tag)problems.push('move-type-by-tag requires tag');
  if(!CANONICAL_TYPES.includes(params.type))problems.push('move-type-by-tag requires a canonical type');
  return problems;
 }
 return problems;
}
