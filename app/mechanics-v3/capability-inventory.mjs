const REVIEW_RULES=[
 ['stat-stages',/\b(boost|boosting|raise|raises|raising|lower|lowers|lowering|stat changes?|stats?)\b/i],
 ['major-status',/\b(burns?|burned|burning|paraly\w*|poison\w*|sleep|asleep|freeze|freezes|frozen)\b/i],
 ['volatile-status',/\b(flinch|confus|taunt|encore|disable|infatuat|trapp|seeded)\b/i],
 ['healing',/\b(heal|heals|healing|regain|restores? (?:its|the user's|the target's)? ?hp|recover)\b/i],
 ['weather',/\b(weather|rain|sunlight|sandstorm|snowstorm|snowing|harsh sunlight)\b/i],
 ['terrain',/\bterrain\b/i],
 ['switching',/\b(switch|switches|party pokemon in waiting|fleeing)\b/i],
 ['protection',/\b(protect|guard|blocks attacks|shield)\b/i],
 ['multi-hit',/\b(two to five|hits .*times|strikes .*times|consecutive turns)\b/i],
 ['recoil-drain',/\b(recoil|drain|absorbs? hp|loses hp|some of its own hp)\b/i],
 ['priority-order',/\b(always goes first|acts first|move right after|move immediately after|priority)\b/i],
 ['item-interaction',/\b(held item|holding an item|items? they hold|berry)\b/i],
 ['ability-interaction',/\bability|abilities\b/i],
 ['field-side',/\b(entry hazard|on the opposing team|for five turns|every turn|around the opposing team)\b/i]
];

const countBy=(entries,key)=>Object.fromEntries([...new Set(entries.map(entry=>entry[key]))].sort().map(value=>[value,entries.filter(entry=>entry[key]===value).length]));

export function reviewSignalsForMove(move){
 const description=String(move.description||'');
 return REVIEW_RULES.filter(([,pattern])=>pattern.test(description)).map(([id])=>id);
}

export function buildMoveCapabilityInventory(moves,manifests={}){
 const entries=moves.map(move=>{
  const manifest=manifests[move.id],reviewSignals=reviewSignalsForMove(move),declaredHandlers=(manifest?.handlers||[]).map(entry=>entry.id);
  const primaryQueue=manifest?'manifest-reviewed':reviewSignals[0]||(move.category==='status'?'status-manual-review':'damage-manual-review');
  return {id:move.id,name:move.name,category:move.category,type:move.type,hasPower:Number.isInteger(move.power)&&move.power>0,accuracy:move.accuracy,maxPP:move.maxPP,manifestReviewed:Boolean(manifest),declaredHandlers,primaryQueue,reviewSignals,signalSource:'description-review-only',trustedMechanics:false};
 }).sort((left,right)=>left.id.localeCompare(right.id));
 const signalCounts={};for(const entry of entries)for(const signal of entry.reviewSignals)signalCounts[signal]=(signalCounts[signal]||0)+1;
 return {schemaVersion:1,policy:{descriptionSignals:'research-queue-only',changesImplementation:false,changesLegality:false},summary:{total:entries.length,manifestReviewed:entries.filter(entry=>entry.manifestReviewed).length,manualReview:entries.filter(entry=>!entry.manifestReviewed).length,byCategory:countBy(entries,'category'),byPrimaryQueue:countBy(entries,'primaryQueue'),byReviewSignal:Object.fromEntries(Object.entries(signalCounts).sort(([a],[b])=>a.localeCompare(b)))},entries};
}
