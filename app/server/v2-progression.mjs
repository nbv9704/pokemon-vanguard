import {applyBlueprintImport,applyTeamSave} from './v2-team-actions.mjs';
import {debitV2Coins,getV2ProgressionState,storeV2Progression,v2Coins} from './v2-progression-state.mjs';
import {markV2Tutorial} from './v2-release.mjs';
import {trialIsExpired} from './v2-recruitment-state.mjs';
import {prepareDurableAccountAction,recordDurableAccountAction} from './durable-account-action.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const stats=['hp','atk','def','spa','spd','spe'];
const actionTypes=new Set(['build.save','team.save','blueprint.import']);
export const isV2ProgressionAction=action=>actionTypes.has(action?.type);
export function getV2Progression(state,catalog){return getV2ProgressionState(state,catalog);}

export function validateBuildInput(build,mon,catalog){
 const errors=[];const species=catalog.speciesById[mon.speciesId];
 if(typeof build.name!=='string'||!build.name.trim()||build.name.trim().length>40)errors.push('INVALID_BUILD_NAME');
 let total=0;for(const key of stats){const value=build.points?.[key];if(!Number.isInteger(value)||value<0||value>32)errors.push('INVALID_BUILD_POINTS');else total+=value;}if(total>66)errors.push('INVALID_BUILD_POINTS');
 const up=build.alignment?.up??null,down=build.alignment?.down??null,aligned=stats.slice(1);if((up===null)!==(down===null)||up===down&&up!==null||up!==null&&!aligned.includes(up)||down!==null&&!aligned.includes(down))errors.push('INVALID_BUILD_ALIGNMENT');
 if(!Array.isArray(build.moveIds)||build.moveIds.length!==4||new Set(build.moveIds).size!==4||build.moveIds.some(id=>!species.moveIds.includes(id)||!catalog.movesById[id]))errors.push('INVALID_BUILD_MOVES');
 if(!species.abilityIds.includes(build.abilityId))errors.push('INVALID_BUILD_ABILITY');if(!catalog.itemsById[build.itemId])errors.push('INVALID_BUILD_ITEM');
 return [...new Set(errors)];
}

const battleFields=build=>JSON.stringify({points:build.points,alignment:build.alignment,abilityId:build.abilityId,moveIds:build.moveIds,itemId:build.itemId});
export function applyV2ProgressionAction(state,action,catalog){
 if(!isV2ProgressionAction(action))return {ok:false,code:'UNKNOWN_V2_ACTION'};
 const prepared=prepareDurableAccountAction(state,action,'v2-player',{optional:true});if(!prepared.ok)return prepared;if(prepared.duplicate)return {ok:true,state:prepared.base,duplicate:true,receipt:prepared.receipt};
 const base=prepared.base,progression=getV2Progression(base,catalog),finish=result=>{if(!result.ok||prepared.legacy)return result;const receipt=recordDurableAccountAction(result.state,action,'v2-player',prepared.fingerprint,{progressionRevision:result.state.progressionRevision??result.state.progressionV2?.revision??0,cost:result.cost||0,...(result.build?{buildId:result.build.buildId}:{}),...(result.team?{teamId:result.team.teamId}:{}),...(result.blueprint?{blueprintId:result.blueprint.blueprintId}:{})});return {...result,duplicate:false,receipt};};
 if(action?.type==='build.save'){
  const input=action.build;if(!input||typeof input!=='object')return {ok:false,code:'INVALID_BUILD'};
  const mon=progression.mons.find(entry=>entry.monId===input.monId);if(!mon)return {ok:false,code:'MON_NOT_OWNED'};if(mon.ownership==='trial')return {ok:false,code:'TRIAL_READ_ONLY'};
  const errors=validateBuildInput(input,mon,catalog);if(errors.length)return {ok:false,code:'INVALID_BUILD',details:errors};
  const existing=input.buildId?progression.builds.find(entry=>entry.buildId===input.buildId):null;
  if(input.buildId&&!existing)return {ok:false,code:'BUILD_NOT_FOUND'};if(existing&&existing.monId!==mon.monId)return {ok:false,code:'INVALID_BUILD'};
  if(existing&&action.expectedRevision!==existing.revision)return {ok:false,code:'STALE_REVISION',latest:clone(existing)};
  const ownedBuilds=progression.builds.filter(entry=>entry.monId===mon.monId);if(!existing&&ownedBuilds.length>=3)return {ok:false,code:'BUILD_LIMIT'};
  const normalized={...clone(input),name:input.name.trim()};delete normalized.revision;
  if(existing){const comparable={...existing};delete comparable.revision;if(JSON.stringify(comparable)===JSON.stringify(normalized))return finish({ok:true,state:base,cost:0,noOp:true,build:clone(existing)});}
  const saveCost=Math.max(0,Math.trunc(catalog.economy?.build?.saveCostCoins??10)),contentChanged=!existing||battleFields(existing)!==battleFields(normalized),cost=contentChanged&&(existing||ownedBuilds.length>0)?saveCost:0;
  if(v2Coins(base)<cost)return {ok:false,code:'INSUFFICIENT_COINS'};
  const saved={...normalized,buildId:existing?.buildId||`build-custom-${progression.nextBuildId++}`,revision:(existing?.revision||0)+1};
  if(existing)progression.builds[progression.builds.findIndex(entry=>entry.buildId===existing.buildId)]=saved;else progression.builds.push(saved);
  progression.revision++;debitV2Coins(base,cost);storeV2Progression(base,progression);markV2Tutorial(base,'build');return finish({ok:true,state:base,cost,build:clone(saved)});
 }
 if(action?.type==='team.save'){
  const result=applyTeamSave(base,progression,action);if(result.ok)markV2Tutorial(result.state,'team');return finish(result);
 }
 if(action?.type==='blueprint.import')return finish(applyBlueprintImport(base,progression,action,catalog));
}

const publicMon=(mon,now)=>({monId:mon.monId,speciesId:mon.speciesId,ownership:mon.ownership,trialExpiresAt:mon.trialExpiresAt??null,trialExpired:mon.ownership==='trial'&&now!==undefined?trialIsExpired(mon,now):!!mon.trialExpired,legacyLevel:mon.legacyLevel??undefined,acquiredBy:mon.acquiredBy??undefined});
const publicBuild=build=>({buildId:build.buildId,monId:build.monId,name:build.name,points:clone(build.points),alignment:clone(build.alignment),moveIds:[...(build.moveIds||[])],abilityId:build.abilityId,itemId:build.itemId,revision:build.revision});
const publicTeam=team=>({teamId:team.teamId,name:team.name,buildIds:[...(team.buildIds||[])],revision:team.revision});
const publicBlueprint=blueprint=>({blueprintId:blueprint.blueprintId,schemaVersion:blueprint.schemaVersion,name:blueprint.name,builds:(blueprint.builds||[]).map(spec=>({speciesId:spec.speciesId,name:spec.name,points:clone(spec.points),alignment:clone(spec.alignment),moveIds:[...(spec.moveIds||[])],abilityId:spec.abilityId,itemId:spec.itemId})),missingSpeciesIds:[...(blueprint.missingSpeciesIds||[])],eligible:!!blueprint.eligible});
export function v2TrainingView(state,catalog,{now}={}){const progression=getV2Progression(state,catalog);return {revision:progression.revision,mons:(progression.mons||[]).map(mon=>publicMon(mon,now)),builds:(progression.builds||[]).map(publicBuild),teams:(progression.teams||[]).map(publicTeam),blueprints:(progression.blueprints||[]).map(publicBlueprint),activeTeamId:progression.activeTeamId};}
