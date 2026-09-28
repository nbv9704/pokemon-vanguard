// Backwards-compatible public facade for the split manifest validators.
import {CONTENT_KINDS,BATTLE_FORMATS} from './manifest-values.mjs';
import {validateManifestHandlers} from './manifest-handler-validation.mjs';
import {validateMoveManifest} from './manifest-move-validation.mjs';
export {CONTENT_KINDS,BATTLE_FORMATS,BATTLE_STAGES,MAJOR_STATUS_IDS,VOLATILE_STATUS_IDS,VARIABLE_POWER_FORMULAS,WEATHER_IDS,TERRAIN_IDS,SIDE_CONDITION_IDS,HAZARD_IDS,ROOM_IDS,DELAYED_EFFECT_IDS,TWO_TURN_MOVE_KINDS,SEMI_INVULNERABLE_MODES,MOVE_TAG_IDS,SECONDARY_EFFECT_KINDS,HOOKS} from './manifest-values.mjs';

export function validateMechanicManifest(manifest,kind){
 const problems=[];
 if(!CONTENT_KINDS.includes(kind))return [`unknown content kind: ${kind}`];
 if(!manifest||typeof manifest!=='object')return ['manifest must be an object'];
 if(typeof manifest.id!=='string'||!manifest.id)problems.push('manifest id is required');
 if(manifest.unusable!==undefined&&typeof manifest.unusable!=='boolean')problems.push('unusable must be boolean');
 if(manifest.reviewState!==undefined&&!['executable','fail-closed'].includes(manifest.reviewState))problems.push('reviewState must be executable or fail-closed');
 if(manifest.dynamicTargetMode!==undefined&&!['ghost-or-self'].includes(manifest.dynamicTargetMode))problems.push('dynamicTargetMode must be ghost-or-self');
 if(manifest.reviewState==='fail-closed'&&(typeof manifest.reviewReason!=='string'||!manifest.reviewReason))problems.push('fail-closed manifests require reviewReason');
 if(kind==='items'&&manifest.reviewState==='fail-closed'&&!(manifest.handlers||[]).some(entry=>entry?.id==='reject-unusable-item'))problems.push('fail-closed items require reject-unusable-item');
 if(manifest.unusable===true&&!(manifest.handlers||[]).some(entry=>entry?.id==='reject-unusable-move'))problems.push('unusable moves require reject-unusable-move');
 if(!Array.isArray(manifest.handlers)||!manifest.handlers.length)problems.push('at least one handler is required');
 problems.push(...validateManifestHandlers(manifest,kind));
 for(const format of BATTLE_FORMATS)if(!Array.isArray(manifest.testEvidence?.[format]))problems.push(`${format} testEvidence must be an array`);
 if(kind==='moves')problems.push(...validateMoveManifest(manifest));
 return problems;
}
