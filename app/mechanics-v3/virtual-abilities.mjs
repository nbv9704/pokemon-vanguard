export const VIRTUAL_ABILITY_MANIFESTS=Object.freeze({
 simple:Object.freeze({id:'simple',handlers:[{id:'stat-change-multiplier',hook:'afterStatChange',order:40,params:{multiplier:2}}],virtual:true})
});

export function withVirtualAbilityManifests(manifests){
 if(!manifests)return manifests;
 return {...manifests,abilities:{...(manifests.abilities||{}),...VIRTUAL_ABILITY_MANIFESTS}};
}
