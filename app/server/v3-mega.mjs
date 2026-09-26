import {calculateLevel50Stats} from '../rules-v3/index.mjs';
import {compilePassiveEffects,resolveAbilityStartEffects} from '../mechanics-v3/index.mjs';
import {mechanicCatalog} from './v3-battle-factory.mjs';

const clone=value=>structuredClone(value);

export function megaRelationFor(catalog,unit,regulationSet=catalog.regulations[0].id){
 const baseSpeciesId=unit?.baseSpeciesId||unit?.speciesId;
 return catalog.megaRelations?.find(relation=>relation.baseSpeciesId===baseSpeciesId&&relation.itemId===unit?.buildSnapshot?.itemId&&(relation.regulationSets||[]).some(id=>regulationSet===id||regulationSet.startsWith(`${id}-`)||regulationSet.startsWith(id)))||null;
}

export function validateMegaChoice(battle,action,catalog){
 if(!action?.mega)return {ok:true};
 const unit=battle.sides?.[action.side]?.roster?.find(entry=>entry.actorId===action.actorId);
 if(!unit||unit.hp<=0||!battle.sides[action.side].active.includes(unit.actorId))return {ok:false,code:'MEGA_ACTOR_UNAVAILABLE'};
 if((battle.megaUsed?.[action.side]||0)>=(battle.megaLimit||1))return {ok:false,code:'MEGA_LIMIT_REACHED'};
 if(unit.megaEvolved)return {ok:false,code:'ALREADY_MEGA_EVOLVED'};
 const relation=megaRelationFor(catalog,unit,battle.regulationId);if(!relation)return {ok:false,code:'MEGA_NOT_ELIGIBLE'};
 if(relation.requiredGender&&unit.gender!==relation.requiredGender)return {ok:false,code:'MEGA_GENDER_REQUIRED',requiredGender:relation.requiredGender};
 const form=catalog.speciesById[relation.megaSpeciesId];if(!form)return {ok:false,code:'MEGA_FORM_MISSING'};
 if(!(Number(form.heightM)>0)||!(Number(form.weightKg)>0))return {ok:false,code:'MEGA_FOUNDATION_MISSING'};
 return {ok:true,relation};
}

export function applyMegaEvolution(battle,action,catalog){
 const valid=validateMegaChoice(battle,{...action,mega:true},catalog);if(!valid.ok)return {battle:clone(battle),events:[{kind:'megaFailed',actorId:action.actorId,reason:valid.code}]};
 const next=clone(battle),unit=next.sides[action.side].roster.find(entry=>entry.actorId===action.actorId),form=catalog.speciesById[valid.relation.megaSpeciesId],old={speciesId:unit.speciesId,name:unit.name,maxHp:unit.maxHp,hp:unit.hp};
 const stats=calculateLevel50Stats(form.baseStats,unit.buildSnapshot.statPoints,unit.buildSnapshot.natureId),damageTaken=old.maxHp-old.hp;
 const manifests=mechanicCatalog(catalog);
 unit.speciesId=form.id;unit.name=form.name;unit.spriteKey=form.spriteKey;unit.types=[...form.types];unit.heightM=form.heightM;unit.weightKg=form.weightKg;unit.stats=stats;unit.maxHp=stats.hp;unit.hp=Math.max(1,stats.hp-damageTaken);unit.activeAbilityId=form.abilityId;unit.passiveEffects=compilePassiveEffects({abilityId:form.abilityId,itemId:unit.buildSnapshot.itemId,manifests});unit.megaEvolved=true;
 next.megaUsed[action.side]=(next.megaUsed[action.side]||0)+1;
 const megaEvent={kind:'megaEvolved',actorId:unit.actorId,side:action.side,fromSpeciesId:old.speciesId,toSpeciesId:form.id,name:form.name,spriteKey:form.spriteKey,types:[...form.types],heightM:form.heightM,weightKg:form.weightKg,abilityId:form.abilityId,hpBefore:old.hp,maxHpBefore:old.maxHp,hpAfter:unit.hp,maxHpAfter:unit.maxHp};
 const started=resolveAbilityStartEffects(next,{actorId:unit.actorId,slot:next.sides[action.side].active.indexOf(unit.actorId),manifests,moves:catalog.movesById,trigger:'mega-evolution',allowEntryTransform:false});
 return {battle:started.battle,events:[megaEvent,...started.events]};
}
