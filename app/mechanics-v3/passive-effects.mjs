import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {roomActive} from './rooms.mjs';
import {heldItemEffectActive} from './item-hooks.mjs';

const SUPPORTED_WEATHERS=['sun','rain','snow','sandstorm'];

export function compilePassiveEffects({abilityId=null,itemId=null,manifests}){
 const effects=[];for(const [sourceKind,sourceId] of [['ability',abilityId],['item',itemId]]){
  if(!sourceId||sourceId==='none')continue;const manifest=manifests?.[sourceKind==='ability'?'abilities':'items']?.[sourceId];
  if(!manifest)throw new Error(`unsupported ${sourceKind}: ${sourceId}`);
  for(const handler of manifest.handlers||[])if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-speed','weather-duration','weather-heal','screen-duration','terrain-duration','weather-stat-boost','weather-residual-damage','weather-status-immunity','weather-type-damage-boost','weather-residual-immunity','weather-incoming-accuracy-modifier','volatile-incoming-accuracy-modifier','type-immunity-boost','type-immunity-response','status-type-immunity-bypass','priority-move-immunity-aura','ally-major-status-immunity','ally-stat-drop-immunity','received-type-damage-modifier','contact-response','damage-response','ko-stat-boost','end-turn-stat-boost','lethal-hit-survival','stat-drop-response','volatile-immunity','critical-vs-status','status-residual-heal','status-reflect','flinch-stat-boost','critical-damage-boost','base-power-threshold-boost','move-tag-power-boost','move-tag-immunity','remove-contact','move-type-by-tag','secondary-effect-power-boost','stat-multiplier','outgoing-accuracy-modifier','contact-power-boost','recoil-power-boost','major-status-immunity','critical-ratio','critical-immunity','stab-modifier','recoil-immunity','received-damage-modifier','always-hit','burn-attack-penalty-immunity','stat-drop-immunity','ally-damage-immunity','ally-damage-reduction','ally-ability-stat-multiplier','secondary-effect-immunity','multi-hit-max','weather-status-cure','paralysis-speed-penalty-immunity','switch-out-status-cure','switch-out-heal','random-status-cure','entry-weather','entry-stat-drop','entry-screen-cleaner','entry-ally-stage-reset','entry-ally-heal','item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-resist-hit','item-status-cure','item-post-move-recoil','item-contact-retaliation','item-damage-heal','item-speed-boost','item-speed-modifier','item-accuracy-boost','item-accuracy-after-target','item-incoming-accuracy-modifier','item-critical-ratio','item-choice-lock','item-negative-stage-reset','item-healing-boost','item-terrain-seed','item-pp-restore','item-airborne','item-grounding','item-force-attacker-switch','item-one-shot-damage-boost','item-species-stat-modifier','item-species-critical-ratio','item-consecutive-move-power','item-flinch-chance','item-volatile-cure','item-quick-order'].includes(handler.id))effects.push({sourceKind,sourceId,kind:handler.id,order:handler.order,...handler.params});
 }
 return effects.sort((a,b)=>a.order-b.order||a.sourceKind.localeCompare(b.sourceKind)||a.sourceId.localeCompare(b.sourceId));
}

export function passiveEffectActive(effect,battle,unit=null){
 if(effect?.sourceKind!=='item')return true;
 if(unit)return heldItemEffectActive(unit,effect,battle);
 return !roomActive(battle,'magic-room');
}

export function receivedDamageModifiers(unit,move,battle,{effectiveness=1}={}){
 const applied=(unit?.passiveEffects||[]).filter(effect=>{
  if(!passiveEffectActive(effect,battle,unit))return false;
  if(effect.kind==='received-type-damage-reduction'||effect.kind==='received-type-damage-modifier')return effect.types.includes(move.type);
  if(effect.kind==='received-damage-modifier')return (!effect.requireFullHp||unit.hp===(unit.maxHp??unit.stats?.hp))&&(!effect.superEffective||effectiveness>1);
  return false;
 });
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

export function passiveDamageModifiers(unit,move,battle,{critical=false,effectiveness=1}={}){
 const applied=[];for(const effect of unit?.passiveEffects||[]){
  if(!passiveEffectActive(effect,battle,unit))continue;
  if(effect.kind==='low-hp-type-boost'&&move.type===effect.type&&unit.hp*effect.hpDenominator<=unit.maxHp)applied.push(effect);
  if(effect.kind==='held-damage-boost'&&((effect.allDamaging===true&&move.category!=='status')||(effect.type&&move.type===effect.type)||(effect.category&&move.category===effect.category)||(effect.superEffective===true&&move.category!=='status'&&effectiveness>1)))applied.push(effect);
  if(effect.kind==='critical-damage-boost'&&critical)applied.push(effect);
  if(effect.kind==='weather-type-damage-boost'&&effect.weather===battle.field?.weather?.id&&Array.isArray(effect.types)&&effect.types.includes(move.type))applied.push(effect);
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
 if(entry.id==='received-type-damage-modifier'){
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('received-type-damage-modifier requires distinct canonical types');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier===1)problems.push('received-type-damage-modifier requires a positive non-1 multiplier');
  return problems;
 }
 if(entry.id==='contact-response'){
  if(!['damage','status','stat'].includes(params.response))problems.push('contact-response requires damage, status, or stat response');
  if(params.chance!==undefined&&(!Number.isFinite(params.chance)||params.chance<=0||params.chance>1))problems.push('contact-response chance must be in (0, 1]');
  if(params.response==='damage'&&(!Number.isInteger(params.numerator)||!Number.isInteger(params.denominator)||params.numerator<1||params.denominator<1||params.numerator>params.denominator))problems.push('contact-response damage requires a valid positive fraction');
  if(params.response==='status'&&!['burn','paralysis','poison','sleep','freeze','bad-poison'].includes(params.status))problems.push('contact-response status requires a supported major status');
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
  const responses=[params.boosts!==undefined,params.setStages!==undefined,params.weather!==undefined,params.hazard!==undefined].filter(Boolean).length;if(responses!==1)problems.push('damage-response requires exactly one response');
  for(const field of ['boosts','setStages'])if(params[field]!==undefined){const entries=params[field]&&typeof params[field]==='object'&&!Array.isArray(params[field])?Object.entries(params[field]):[];if(!entries.length)problems.push(`damage-response ${field} requires stages`);for(const [stat,value] of entries){if(!['atk','def','spa','spd','spe','accuracy','evasion'].includes(stat))problems.push(`damage-response ${field} has unsupported stat`);if(!Number.isInteger(value)||value<-6||value>6||(field==='boosts'&&value===0))problems.push(`damage-response ${field} has invalid stage value`);}}
  if(params.weather!==undefined&&!SUPPORTED_WEATHERS.includes(params.weather))problems.push('damage-response weather must be supported');
  if(params.hazard!==undefined&&!['stealth-rock','spikes','toxic-spikes'].includes(params.hazard))problems.push('damage-response hazard must be supported');
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
  if(params.requireFullHp!==true&&params.superEffective!==true)problems.push('received-damage-modifier requires a supported condition');
  return problems;
 }
 if(entry.id==='always-hit'||entry.id==='burn-attack-penalty-immunity')return problems;

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
  if(!Array.isArray(params.volatiles)||!params.volatiles.length||new Set(params.volatiles).size!==params.volatiles.length||params.volatiles.some(id=>!['confusion','flinch','taunt','encore','disable','leech-seed'].includes(id)))problems.push('volatile-immunity requires distinct supported volatiles');
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
 if(entry.id==='entry-weather'){
  if(!SUPPORTED_WEATHERS.includes(params.weather))problems.push('entry-weather requires supported weather');
  if(!Number.isInteger(params.turns)||params.turns<1)problems.push('entry-weather requires positive turns');
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
 if(entry.id==='item-force-attacker-switch')return problems;
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
 if(entry.id==='move-type-by-tag'){
  if(typeof params.tag!=='string'||!params.tag)problems.push('move-type-by-tag requires tag');
  if(!CANONICAL_TYPES.includes(params.type))problems.push('move-type-by-tag requires a canonical type');
  return problems;
 }
 return problems;
}
