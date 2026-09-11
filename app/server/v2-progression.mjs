import {applyBlueprintImport,applyTeamSave} from './v2-team-actions.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const stats=['hp','atk','def','spa','spd','spe'];

function initialProgression(state,catalog){
 const mons=(state.collection||[]).map(owned=>{const species=catalog.species.find(entry=>entry.legacyId===owned.id);return {monId:`mon-${species.id}`,speciesId:species.id,ownership:'permanent'};});
 const builds=mons.map(mon=>{const species=catalog.speciesById[mon.speciesId];return {buildId:`build-${mon.speciesId}-1`,monId:mon.monId,...clone(species.defaultBuild),revision:1};});
 const bySpecies=new Map(builds.map(build=>[build.monId.slice(4),build.buildId]));
 const buildIds=(state.team||[]).map(id=>catalog.species.find(entry=>entry.legacyId===id)?.id).map(id=>bySpecies.get(id)).filter(Boolean);
 return {revision:1,nextBuildId:1,nextTeamId:1,nextBlueprintId:1,mons,builds,teams:[{teamId:'team-default',name:'Đội hiện tại',buildIds,revision:1}],blueprints:[],activeTeamId:'team-default'};
}

export function getV2Progression(state,catalog){return clone(state.progressionV2||initialProgression(state,catalog));}

export function validateBuildInput(build,mon,catalog){
 const errors=[];const species=catalog.speciesById[mon.speciesId];
 if(typeof build.name!=='string'||!build.name.trim()||build.name.trim().length>40)errors.push('INVALID_BUILD_NAME');
 let total=0;for(const key of stats){const value=build.points?.[key];if(!Number.isInteger(value)||value<0||value>16)errors.push('INVALID_BUILD_POINTS');else total+=value;}if(total>32)errors.push('INVALID_BUILD_POINTS');
 const up=build.alignment?.up??null,down=build.alignment?.down??null,aligned=stats.slice(1);if((up===null)!==(down===null)||up===down&&up!==null||up!==null&&!aligned.includes(up)||down!==null&&!aligned.includes(down))errors.push('INVALID_BUILD_ALIGNMENT');
 if(!Array.isArray(build.moveIds)||build.moveIds.length!==4||new Set(build.moveIds).size!==4||build.moveIds.some(id=>!species.moveIds.includes(id)||!catalog.movesById[id]))errors.push('INVALID_BUILD_MOVES');
 if(!species.abilityIds.includes(build.abilityId))errors.push('INVALID_BUILD_ABILITY');if(!catalog.itemsById[build.itemId])errors.push('INVALID_BUILD_ITEM');
 return [...new Set(errors)];
}

const battleFields=build=>JSON.stringify({points:build.points,alignment:build.alignment,abilityId:build.abilityId,moveIds:build.moveIds,itemId:build.itemId});
export function applyV2ProgressionAction(state,action,catalog){
 const base=clone(state),progression=getV2Progression(base,catalog);
 if(action?.type==='build.save'){
  const input=action.build;if(!input||typeof input!=='object')return {ok:false,code:'INVALID_BUILD'};
  const mon=progression.mons.find(entry=>entry.monId===input.monId);if(!mon)return {ok:false,code:'MON_NOT_OWNED'};if(mon.ownership==='trial')return {ok:false,code:'TRIAL_READ_ONLY'};
  const errors=validateBuildInput(input,mon,catalog);if(errors.length)return {ok:false,code:'INVALID_BUILD',details:errors};
  const existing=input.buildId?progression.builds.find(entry=>entry.buildId===input.buildId):null;
  if(input.buildId&&!existing)return {ok:false,code:'BUILD_NOT_FOUND'};if(existing&&existing.monId!==mon.monId)return {ok:false,code:'INVALID_BUILD'};
  if(existing&&action.expectedRevision!==existing.revision)return {ok:false,code:'STALE_REVISION',latest:clone(existing)};
  const ownedBuilds=progression.builds.filter(entry=>entry.monId===mon.monId);if(!existing&&ownedBuilds.length>=3)return {ok:false,code:'BUILD_LIMIT'};
  const normalized={...clone(input),name:input.name.trim()};delete normalized.revision;
  if(existing){const comparable={...existing};delete comparable.revision;if(JSON.stringify(comparable)===JSON.stringify(normalized))return {ok:true,state:base,cost:0,noOp:true,build:clone(existing)};}
  const contentChanged=!existing||battleFields(existing)!==battleFields(normalized),cost=contentChanged&&(existing||ownedBuilds.length>0)?10:0;
  if((base.coins||0)<cost)return {ok:false,code:'INSUFFICIENT_COINS'};
  const saved={...normalized,buildId:existing?.buildId||`build-custom-${progression.nextBuildId++}`,revision:(existing?.revision||0)+1};
  if(existing)progression.builds[progression.builds.findIndex(entry=>entry.buildId===existing.buildId)]=saved;else progression.builds.push(saved);
  progression.revision++;base.coins-=cost;base.progressionV2=progression;return {ok:true,state:base,cost,build:clone(saved)};
 }
 if(action?.type==='team.save'){
  return applyTeamSave(base,progression,action);
 }
 if(action?.type==='blueprint.import')return applyBlueprintImport(base,progression,action,catalog);
 return {ok:false,code:'UNKNOWN_V2_ACTION'};
}

export function v2TrainingView(state,catalog){const progression=getV2Progression(state,catalog);return {revision:progression.revision,mons:progression.mons,builds:progression.builds,teams:progression.teams,blueprints:progression.blueprints||[],activeTeamId:progression.activeTeamId};}
