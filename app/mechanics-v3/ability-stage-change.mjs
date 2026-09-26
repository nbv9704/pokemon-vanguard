const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);

export function abilityStageChange(unit,requestedDelta){
 const inversion=abilityEffects(unit,'stat-change-inversion')[0]||null,multiplier=abilityEffects(unit,'stat-change-multiplier')[0]||null;
 if(!Number.isInteger(requestedDelta)||requestedDelta===0)return {requestedDelta,originalRequestedDelta:requestedDelta,sourceAbilityId:null,effectId:null};
 if(inversion)return {requestedDelta:-requestedDelta,originalRequestedDelta:requestedDelta,sourceAbilityId:inversion.sourceId,effectId:inversion.kind};
 if(multiplier)return {requestedDelta:requestedDelta*(multiplier.multiplier||2),originalRequestedDelta:requestedDelta,sourceAbilityId:multiplier.sourceId,effectId:multiplier.kind};
 return {requestedDelta,originalRequestedDelta:requestedDelta,sourceAbilityId:null,effectId:null};
}

export function abilityIgnoresOpponentStage(unit,stat,role){
 const key=role==='attacking'?'whenAttacking':role==='defending'?'whenDefending':null;if(!key)return null;
 return abilityEffects(unit,'opponent-stage-ignore').find(effect=>(effect[key]||[]).includes(stat))||null;
}
