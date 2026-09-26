const PROFILES=Object.freeze({
 simple:Object.freeze({
  id:'simple',
  handlers:Object.freeze([
   Object.freeze({id:'stat-change-multiplier',order:20,params:Object.freeze({multiplier:2})})
  ])
 })
});

export function transientAbilityProfile(abilityId){
 return PROFILES[abilityId]||null;
}

export function hasTransientAbilityProfile(abilityId){
 return Boolean(transientAbilityProfile(abilityId));
}
