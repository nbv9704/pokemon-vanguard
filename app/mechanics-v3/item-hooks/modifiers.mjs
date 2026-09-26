import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {TYPE_CHART,typeEffectiveness} from '../../rules-v3/type-chart.mjs';
import {gravityActive} from '../gravity.mjs';
import {abilityGroundingImmunity,abilityTypeImmunityBypass} from '../ability-hooks.mjs';
import {heldItemHasEffect,itemEffects} from './state.mjs';

export function typeEffectivenessWithHeldItems(attackType,defender,battle,{attacker=null,ignoreDefenderAbility=false,typeEffectivenessOverrides=null}={}){
 if(!defender)return 1;
 const forcedGrounded=attackType==='ground'&&(gravityActive(battle)||Boolean(defender.volatiles?.['forced-grounded'])),grounded=attackType==='ground'&&(forcedGrounded||heldItemHasEffect(defender,'item-grounding',battle));
 if(attackType==='ground'&&!grounded&&(heldItemHasEffect(defender,'item-airborne',battle)||(!ignoreDefenderAbility&&abilityGroundingImmunity(defender))))return 0;
 let types=[...(defender.types||[])];if(grounded)types=types.filter(type=>type!=='flying');
 const bypass=attacker&&abilityTypeImmunityBypass(attacker,attackType,defender);if(bypass)types=types.filter(type=>!(bypass.targetTypes||[]).includes(type));
 if(!types.length)return 1;
 if(!typeEffectivenessOverrides||typeof typeEffectivenessOverrides!=='object')return typeEffectiveness(attackType,types);
 return types.reduce((value,type)=>value*(typeEffectivenessOverrides[type]??TYPE_CHART[attackType]?.[type]??1),1);
}

export function speedWithHeldItems(speed,unit,battle){
 const effects=[...itemEffects(unit,'item-speed-boost',battle),...itemEffects(unit,'item-speed-modifier',battle)],multiplier=effects.reduce((value,effect)=>value*(effect.multiplier??1),1);
 return multiplier===1?speed:Math.floor(speed*multiplier);
}

export function statWithHeldItems(value,unit,stat,battle){
 if(!Number.isFinite(value)||!unit||!['atk','spa'].includes(stat))return value;
 const baseSpeciesId=unit.baseSpeciesId||unit.speciesId,effects=itemEffects(unit,'item-species-stat-modifier',battle).filter(effect=>Array.isArray(effect.speciesIds)&&effect.speciesIds.includes(baseSpeciesId)&&Array.isArray(effect.stats)&&effect.stats.includes(stat));
 return effects.length?Math.floor(effects.reduce((current,effect)=>current*(effect.multiplier??1),value)):value;
}

export function accuracyWithHeldItems(accuracy,unit,battle,{target=null,targetHasActed=false,targetWillMove=null}={}){
 if(accuracy===null)return null;const boost=itemEffects(unit,'item-accuracy-boost',battle)[0],afterTarget=(targetWillMove===false||targetHasActed)?itemEffects(unit,'item-accuracy-after-target',battle)[0]:null,incoming=target?itemEffects(target,'item-incoming-accuracy-modifier',battle)[0]:null,multiplier=(boost?.multiplier??1)*(afterTarget?.multiplier??1)*(incoming?.multiplier??1);
 return multiplier===1?accuracy:Math.min(100,Math.floor(accuracy*multiplier));
}

export function healingWithHeldItems(amount,unit,battle,{source}={}){
 if(!Number.isInteger(amount)||amount<=0)return amount;const effect=itemEffects(unit,'item-healing-boost',battle).find(effect=>Array.isArray(effect.sources)&&effect.sources.includes(source));
 return effect?Math.max(1,Math.floor(amount*effect.multiplier)):amount;
}

export function criticalChanceWithHeldItems(unit,battle,{baseStage=0}={}){
 const speciesId=unit?.baseSpeciesId||unit?.speciesId,generic=itemEffects(unit,'item-critical-ratio',battle)[0],species=itemEffects(unit,'item-species-critical-ratio',battle).find(effect=>Array.isArray(effect.speciesIds)&&effect.speciesIds.includes(speciesId)),stage=Math.max(0,Math.min(3,baseStage+(generic?.stages??0)+(species?.stages??0)));
 return [1/24,1/8,1/2,1][stage];
}

export function validateChoiceItemMove(battle,action,move){
 if(action?.kind!=='move')return {ok:true};
 const unit=unitById(battle,action.actorId),lock=unit?.volatiles?.['choice-lock'];if(!unit||!lock?.moveId)return {ok:true};
 const effect=itemEffects(unit,'item-choice-lock',battle)[0];if(!effect)return {ok:true};
 if(lock.moveId!==move?.id)return {ok:false,code:'CHOICE_LOCKED_MOVE_REQUIRED',itemId:effect.sourceId,requiredMoveId:lock.moveId};
 return {ok:true};
}

export function applyChoiceItemMoveLock(battle,{actorId,moveId}={}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0||!moveId)return {battle:next,applied:false};
 const effect=itemEffects(unit,'item-choice-lock',next)[0];if(!effect)return {battle:next,applied:false};
 unit.volatiles??={};if(unit.volatiles['choice-lock']?.moveId)return {battle:next,applied:false};
 unit.volatiles['choice-lock']={id:'choice-lock',moveId,sourceItemId:effect.sourceId};
 return {battle:next,applied:true};
}
