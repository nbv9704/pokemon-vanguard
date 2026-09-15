import {activeUnits} from '../rules-v3/battle-state.mjs';

const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&(!kind||effect.kind===kind));

export function activeAbilityHolder(battle,kind){
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){
  const effect=abilityEffects(unit,kind)[0];if(effect)return {unit,effect};
 }
 return null;
}

export function weatherEffectsSuppressed(battle){return Boolean(activeAbilityHolder(battle,'weather-suppression'));}
export function effectiveWeatherId(battle){return weatherEffectsSuppressed(battle)?null:battle?.field?.weather?.id||null;}
