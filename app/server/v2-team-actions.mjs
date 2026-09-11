import {storeV2Progression} from './v2-progression-state.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
export const BLUEPRINT_SCHEMA_VERSION=1;
export const BLUEPRINT_MAX_BYTES=64*1024;

function teamBuilds(input,progression){return input.buildIds.map(id=>progression.builds.find(build=>build.buildId===id));}

export function validateTeamInput(input,progression,{requireComplete=false}={}){
 const errors=[];
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>40||!Array.isArray(input.buildIds)||input.buildIds.length<1||input.buildIds.length>6)return ['TEAM_SHAPE'];
 const builds=teamBuilds(input,progression);if(builds.some(build=>!build))errors.push('UNKNOWN_BUILD');
 const species=builds.map(build=>progression.mons.find(mon=>mon.monId===build?.monId)?.speciesId);if(new Set(species).size!==species.length)errors.push('SPECIES_CLAUSE');
 const items=builds.map(build=>build?.itemId).filter(id=>id&&id!=='none');if(input.buildIds.length===6&&new Set(items).size!==items.length)errors.push('ITEM_CLAUSE');
 if(requireComplete&&input.buildIds.length!==6)errors.push('TEAM_SIZE');
 return [...new Set(errors)];
}

export function applyTeamSave(base,progression,action){
 const input=action.team,errors=validateTeamInput(input,progression);if(errors.length)return {ok:false,code:'TEAM_ILLEGAL',details:errors};
 const existing=input.teamId?progression.teams.find(team=>team.teamId===input.teamId):null;if(input.teamId&&!existing)return {ok:false,code:'TEAM_NOT_FOUND'};
 if(existing&&action.expectedRevision!==existing.revision)return {ok:false,code:'STALE_REVISION',latest:clone(existing)};
 const normalized={teamId:existing?.teamId||`team-${progression.nextTeamId++}`,name:input.name.trim(),buildIds:[...input.buildIds],revision:(existing?.revision||0)+1};
 if(existing&&existing.name===normalized.name&&JSON.stringify(existing.buildIds)===JSON.stringify(normalized.buildIds))return {ok:true,state:base,cost:0,noOp:true,team:clone(existing)};
 if(existing)progression.teams[progression.teams.findIndex(team=>team.teamId===existing.teamId)]=normalized;else progression.teams.push(normalized);
 progression.revision++;storeV2Progression(base,progression);return {ok:true,state:base,cost:0,team:clone(normalized)};
}

function validateBuildSpec(spec,catalog){
 const species=catalog.speciesById[spec?.speciesId];if(!species||typeof spec.name!=='string'||!spec.name.trim()||spec.name.length>40)return false;
 const pointKeys=Object.keys(spec.points||{}).sort(),total=Object.values(spec.points||{});if(JSON.stringify(pointKeys)!==JSON.stringify(['atk','def','hp','spa','spd','spe'])||total.some(value=>!Number.isInteger(value)||value<0||value>16)||total.reduce((sum,value)=>sum+value,0)>32)return false;
 if(!species.abilityIds.includes(spec.abilityId)||!Array.isArray(spec.moveIds)||spec.moveIds.length!==4||new Set(spec.moveIds).size!==4||spec.moveIds.some(id=>!species.moveIds.includes(id))||!catalog.itemsById[spec.itemId])return false;
 const {up=null,down=null}=spec.alignment||{};return (up===null&&down===null)||(up!==down&&['atk','def','spa','spd','spe'].includes(up)&&['atk','def','spa','spd','spe'].includes(down));
}

export function sanitizeBlueprint(input,progression,catalog){
 const bytes=Buffer.byteLength(typeof input==='string'?input:JSON.stringify(input??null));if(bytes>BLUEPRINT_MAX_BYTES)return {ok:false,code:'BLUEPRINT_TOO_LARGE'};
 let raw=input;try{if(typeof raw==='string')raw=JSON.parse(raw);}catch{return {ok:false,code:'BLUEPRINT_INVALID_JSON'};}
 if(!raw||raw.schemaVersion!==BLUEPRINT_SCHEMA_VERSION||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>40||!Array.isArray(raw.builds)||raw.builds.length<1||raw.builds.length>6)return {ok:false,code:'BLUEPRINT_INVALID'};
 if(raw.builds.some(spec=>!validateBuildSpec(spec,catalog)))return {ok:false,code:'BLUEPRINT_INVALID'};
 const speciesIds=raw.builds.map(spec=>spec.speciesId);if(new Set(speciesIds).size!==speciesIds.length)return {ok:false,code:'BLUEPRINT_SPECIES_CLAUSE'};
 const owned=new Set(progression.mons.filter(mon=>mon.ownership==='permanent').map(mon=>mon.speciesId));
 const blueprint={blueprintId:`blueprint-${progression.nextBlueprintId||1}`,schemaVersion:BLUEPRINT_SCHEMA_VERSION,name:raw.name.trim(),builds:clone(raw.builds),missingSpeciesIds:speciesIds.filter(id=>!owned.has(id)),eligible:speciesIds.every(id=>owned.has(id))};
 return {ok:true,blueprint};
}

export function applyBlueprintImport(base,progression,action,catalog){
 const result=sanitizeBlueprint(action.blueprint,progression,catalog);if(!result.ok)return result;
 progression.nextBlueprintId=(progression.nextBlueprintId||1)+1;progression.blueprints=[result.blueprint,...(progression.blueprints||[])].slice(0,20);progression.revision++;storeV2Progression(base,progression);
 return {ok:true,state:base,cost:0,blueprint:clone(result.blueprint)};
}
