import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';

export function compilePassiveEffects({abilityId=null,itemId=null,manifests}){
 const effects=[];for(const [sourceKind,sourceId] of [['ability',abilityId],['item',itemId]]){
  if(!sourceId||sourceId==='none')continue;const manifest=manifests?.[sourceKind==='ability'?'abilities':'items']?.[sourceId];
  if(!manifest)throw new Error(`unsupported ${sourceKind}: ${sourceId}`);
  for(const handler of manifest.handlers||[])if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-speed','weather-duration','weather-heal'].includes(handler.id))effects.push({sourceKind,sourceId,kind:handler.id,order:handler.order,...handler.params});
 }
 return effects.sort((a,b)=>a.order-b.order||a.sourceKind.localeCompare(b.sourceKind)||a.sourceId.localeCompare(b.sourceId));
}

export function receivedDamageModifiers(unit,move){
 const applied=(unit?.passiveEffects||[]).filter(effect=>effect.kind==='received-type-damage-reduction'&&effect.types.includes(move.type));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

export function passiveDamageModifiers(unit,move){
 const applied=[];for(const effect of unit?.passiveEffects||[]){
  if(effect.kind==='low-hp-type-boost'&&move.type===effect.type&&unit.hp*effect.hpDenominator<=unit.maxHp)applied.push(effect);
  if(effect.kind==='held-damage-boost'&&(!effect.type||move.type===effect.type)&&(!effect.category||move.category===effect.category))applied.push(effect);
 }
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

export function validatePassiveHandler(entry){
 const problems=[],params=entry.params||{};
 if(entry.id==='low-hp-type-boost'){
  if(!CANONICAL_TYPES.includes(params.type))problems.push('low-hp-type-boost requires a canonical type');
  if(!Number.isInteger(params.hpDenominator)||params.hpDenominator<2)problems.push('low-hp-type-boost requires hpDenominator >= 2');
 }
 if(entry.id==='held-damage-boost'){
  const selectors=Number(CANONICAL_TYPES.includes(params.type))+Number(['physical','special'].includes(params.category));if(selectors!==1)problems.push('held-damage-boost requires exactly one supported selector');
 }
 if(entry.id==='received-type-damage-reduction'){
  if(!Array.isArray(params.types)||!params.types.length||new Set(params.types).size!==params.types.length||params.types.some(type=>!CANONICAL_TYPES.includes(type)))problems.push('received-type-damage-reduction requires distinct canonical types');
  if(!Number.isFinite(params.multiplier)||params.multiplier<=0||params.multiplier>=1)problems.push('received-type-damage-reduction requires multiplier between 0 and 1');
 }else if(!Number.isFinite(params.multiplier)||params.multiplier<=1)problems.push(`${entry.id} requires multiplier > 1`);
 return problems;
}
