import {validateTeamInput} from './v2-team-actions.mjs';
import {trialExpiryMs} from './v2-recruitment-state.mjs';

export function regulationFor(catalog,id){return catalog.regulations.find(rule=>rule.id===id)||null;}

function trialExpired(mon,now){
 if(mon?.ownership!=='trial')return false;if(mon.trialExpired===true)return true;if(now===undefined||now===null)return false;const expiry=trialExpiryMs(mon);return expiry===null||expiry<=now;
}

export function validateRosterForRegulation(team,progression,catalog,regulationId,mode,{now}={}){
 const rule=regulationFor(catalog,regulationId);if(!rule||!['single','double'].includes(mode)||!rule.roster[mode])return {ok:false,code:'REGULATION_NOT_FOUND',details:[]};
 const errors=validateTeamInput(team,progression,{requireComplete:false}),[min,max]=rule.roster[mode];if(team.buildIds.length<min||team.buildIds.length>max)errors.push('TEAM_SIZE');
 if(!rule.itemClause){const index=errors.indexOf('ITEM_CLAUSE');if(index>=0)errors.splice(index,1);}
 const mons=team.buildIds.map(id=>progression.builds.find(build=>build.buildId===id)).map(build=>progression.mons.find(mon=>mon.monId===build?.monId));
 if(!rule.allowTrial&&mons.some(mon=>mon?.ownership==='trial'))errors.push('TRIAL_NOT_ALLOWED');
 if(mons.some(mon=>trialExpired(mon,now)))errors.push('TRIAL_EXPIRED');
 return errors.length?{ok:false,code:'ROSTER_ILLEGAL',details:[...new Set(errors)]}:{ok:true,rule};
}

export function validatePreviewSelection(buildIds,team,progression,catalog,regulationId,mode,{now}={}){
 const roster=validateRosterForRegulation(team,progression,catalog,regulationId,mode,{now});if(!roster.ok)return roster;const [min,max]=roster.rule.pick[mode];
 if(!Array.isArray(buildIds)||buildIds.length<min||buildIds.length>max||new Set(buildIds).size!==buildIds.length||buildIds.some(id=>!team.buildIds.includes(id)))return {ok:false,code:'INVALID_PREVIEW_SELECTION',details:['PICK_SIZE_OR_REFERENCE']};
 return {ok:true,rule:roster.rule,leadCount:roster.rule.lead[mode]};
}

export function publicPreviewRoster(team,progression,catalog){return team.buildIds.map(buildId=>{const build=progression.builds.find(entry=>entry.buildId===buildId),mon=progression.mons.find(entry=>entry.monId===build.monId),species=catalog.speciesById[mon.speciesId];return {buildId,speciesId:species.id,name:species.name,types:species.types,artId:species.artId};});}
