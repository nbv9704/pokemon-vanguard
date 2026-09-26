const clone=value=>structuredClone(value);
const allocate=(collection,field,prefix,start)=>{let serial=Math.max(1,Number(start)||1),id;do{id=`${prefix}-${serial++}`;}while(collection.some(entry=>entry[field]===id));return {id,next:serial};};

export function grantPokemonToProgression(progression,species,{acquiredBy='admin'}={}){
 const existing=progression.mons.find(entry=>entry.speciesId===species.id);
 if(existing?.ownership==='permanent')return {ok:false,code:'POKEMON_ALREADY_OWNED',existing:true};
 if(existing){Object.assign(existing,{ownership:'permanent',trialExpiresAt:null,trialExpired:false,acquiredBy});progression.revision++;return {ok:true,monId:existing.monId,upgraded:true};}
 const monId=allocate(progression.mons,'monId','v3-mon-admin',progression.nextMonSerial),owned=progression.ownedItemIds||[],defaults=species.defaultBuild,itemId=owned.includes(defaults.itemId)?defaults.itemId:(owned.includes('leftovers')?'leftovers':owned[0]||defaults.itemId),buildId=allocate(progression.builds,'buildId','v3-build-admin',progression.nextBuildSerial);
 progression.nextMonSerial=monId.next;progression.nextBuildSerial=buildId.next;
 progression.mons.push({monId:monId.id,speciesId:species.id,ownership:'permanent',trialExpiresAt:null,trialExpired:false,acquiredBy});
 progression.builds.push({buildId:buildId.id,monId:monId.id,name:defaults.name,natureId:defaults.natureId,statPoints:clone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId,revision:1});
 progression.revision++;return {ok:true,monId:monId.id,buildId:buildId.id};
}
