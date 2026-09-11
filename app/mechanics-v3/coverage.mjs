import {BATTLE_FORMATS,CONTENT_KINDS,validateMechanicManifest} from './manifest-contract.mjs';

const singular={moves:'move',abilities:'ability',items:'item'};

export function validateManifestCatalog(catalog,manifests){
 const problems=[];
 if(manifests?.schemaVersion!==1)problems.push('unsupported manifest schemaVersion');
 for(const kind of CONTENT_KINDS){
  const catalogIds=new Set((catalog[kind]||[]).map(entry=>entry.id));
  for(const [id,manifest] of Object.entries(manifests?.[kind]||{})){
   if(!catalogIds.has(id))problems.push(`${kind} manifest references unknown id ${id}`);
   if(manifest?.id!==id)problems.push(`${kind} manifest key/id mismatch for ${id}`);
  }
 }
 return problems;
}

export function coverageForEntry(kind,entry,manifest,registeredHandlers,registeredTests){
 const base={kind:singular[kind],id:entry.id,name:entry.name,requiredHandlers:manifest?.handlers?.map(handler=>handler.id)||[],formats:{}};
 const problems=manifest?validateMechanicManifest(manifest,kind):[];
 const missingHandlers=manifest?[...new Set(base.requiredHandlers.filter(id=>!registeredHandlers.has(id)))]:[];
 for(const format of BATTLE_FORMATS){
  let reason=null;
  if(!manifest)reason='missing-manifest';
  else if(problems.length)reason=`invalid-manifest:${problems[0]}`;
  else if(missingHandlers.length)reason=`missing-handler:${missingHandlers.join(',')}`;
  else if(!manifest.testEvidence[format].length)reason='missing-test-evidence';
  else{const unknown=manifest.testEvidence[format].filter(id=>!registeredTests.has(id));if(unknown.length)reason=`unknown-test-evidence:${unknown.join(',')}`;}
  base.formats[format]={supported:reason===null,reason};
 }
 return {...base,missingHandlers,manifestProblems:problems};
}

export function buildMechanicsCoverage(catalog,manifests,registeredHandlerIds=[],registeredTestIds=[]){
 const catalogProblems=validateManifestCatalog(catalog,manifests);if(catalogProblems.length)throw new Error(catalogProblems.join('; '));
 const registered=new Set(registeredHandlerIds),tests=new Set(registeredTestIds),entries=[];
 for(const kind of CONTENT_KINDS)for(const entry of catalog[kind]||[])entries.push(coverageForEntry(kind,entry,manifests[kind]?.[entry.id],registered,tests));
 const summary={total:entries.length};
 for(const format of BATTLE_FORMATS){summary[format]={supported:entries.filter(entry=>entry.formats[format].supported).length,blocked:entries.filter(entry=>!entry.formats[format].supported).length};}
 summary.byKind=Object.fromEntries(CONTENT_KINDS.map(kind=>[kind,{total:(catalog[kind]||[]).length,singleSupported:entries.filter(entry=>entry.kind===singular[kind]&&entry.formats.single.supported).length,doubleSupported:entries.filter(entry=>entry.kind===singular[kind]&&entry.formats.double.supported).length}]));
 return {schemaVersion:1,summary,entries};
}
