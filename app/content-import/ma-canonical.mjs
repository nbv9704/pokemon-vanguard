const clone=value=>structuredClone(value);
const byId=list=>new Map(list.map(entry=>[entry.id,entry]));

export function applyMaCanonicalOverlay(species,canonical){
 if(!canonical||canonical.schemaVersion!==1)throw new Error('invalid M-A canonical overlay');
 const excluded=new Set(canonical.excludedSnapshotIds||[]),base=(species||[]).filter(entry=>!excluded.has(entry.id)).map(clone),index=byId(base);
 for(const form of canonical.addedForms||[]){
  const source=index.get(form.copyFromId);if(!source)throw new Error(`M-A canonical overlay missing copy source ${form.copyFromId}`);
  const entry={...clone(source),id:form.id,sourceSlug:form.sourceSlug||form.id,sourceId:form.sourceId||`reviewed:${form.id}`,formId:form.formId||form.id,name:form.name||form.id,baseStats:clone(form.baseStats||source.baseStats),spriteKey:form.spriteKey||form.id};
  delete entry.heightM;delete entry.weightKg;index.set(entry.id,entry);base.push(entry);
 }
 const signatureEntries=Object.entries(canonical.rotomSignatures||{}),signatures=new Set(signatureEntries.map(([,moveId])=>moveId).filter(Boolean)),rotom=index.get('rotom');
 if(rotom&&signatureEntries.length){
  const common=(rotom.moveIds||[]).filter(moveId=>!signatures.has(moveId));
  for(const [id,signature] of signatureEntries){const entry=index.get(id);if(!entry)throw new Error(`M-A canonical overlay missing Rotom form ${id}`);entry.moveIds=[...common,...(signature?[signature]:[])];}
 }
 const output=[...index.values()].sort((a,b)=>a.id.localeCompare(b.id));
 const actual=output.filter(entry=>entry.regulationSets?.includes(canonical.regulationSet||'m-a')).map(entry=>entry.id).sort(),expected=[...(canonical.expectedNonMegaIds||[])].sort();
 if(expected.length&&(actual.length!==expected.length||actual.some((id,i)=>id!==expected[i])))throw new Error(`M-A canonical ID mismatch: expected ${expected.length}, got ${actual.length}`);
 return output;
}
