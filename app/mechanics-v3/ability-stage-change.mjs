const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);

export function abilityStageChange(unit,requestedDelta){
 const effect=abilityEffects(unit,'stat-change-inversion')[0]||null;
 return effect&&Number.isInteger(requestedDelta)&&requestedDelta!==0
  ?{requestedDelta:-requestedDelta,originalRequestedDelta:requestedDelta,sourceAbilityId:effect.sourceId,effectId:effect.kind}
  :{requestedDelta,originalRequestedDelta:requestedDelta,sourceAbilityId:null,effectId:null};
}

export function abilityIgnoresOpponentStage(unit,stat,role){
 const key=role==='attacking'?'whenAttacking':role==='defending'?'whenDefending':null;if(!key)return null;
 return abilityEffects(unit,'opponent-stage-ignore').find(effect=>(effect[key]||[]).includes(stat))||null;
}
