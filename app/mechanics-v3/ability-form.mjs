import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {calculateLevel50Stats} from '../rules-v3/stats.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {effectiveWeatherId} from './ability-field.mjs';
import {resolveHpThresholdItems} from './item-hooks/threshold.mjs';

const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);
const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

function fieldValue(battle,effect){return effect.field==='weather'?effectiveWeatherId(battle):battle?.field?.terrain?.id||null;}
function formIdentity(unit){return {speciesId:unit.speciesId,name:unit.name,spriteKey:unit.spriteKey,types:[...(unit.types||[])]};}
function applyIdentityProfile(unit,profile){if(!profile)return false;const before=JSON.stringify(formIdentity(unit));if(profile.speciesId)unit.speciesId=profile.speciesId;if(profile.name)unit.name=profile.name;if(profile.spriteKey)unit.spriteKey=profile.spriteKey;if(profile.types)unit.types=[...profile.types];return JSON.stringify(formIdentity(unit))!==before;}

export function resolveFieldTypeAbilities(battle,{trigger='field-update'}={}){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  let current=unitById(next,unit.actorId);if(!current||current.hp<=0)continue;
  for(const effect of abilityEffects(current,'field-type-change')){
   if(current.transformState)continue;
   current.abilityState??={};const key=`field-type:${effect.sourceId}`,state=current.abilityState[key]??={baseTypes:[...(effect.defaultTypes||current.types||[])],baseForm:formIdentity(current)};current.abilityState[key]=state;
   const value=fieldValue(next,effect),mapped=value?effect.types?.[value]:null,profile=value?effect.forms?.[value]:null,desiredProfile=profile||(mapped?{types:[mapped]}:effect.defaultForm||{...state.baseForm,types:[...state.baseTypes]}),desired=desiredProfile.types||[...state.baseTypes];
   const before=formIdentity(current),fromTypes=[...(current.types||[])];applyIdentityProfile(current,{...desiredProfile,types:desired});
   if(JSON.stringify(before)===JSON.stringify(formIdentity(current)))continue;
   events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger,field:effect.field,fieldValue:value});
   if(JSON.stringify(fromTypes)!==JSON.stringify(current.types||[]))events.push({kind:'abilityTypeChanged',actorId:current.actorId,abilityId:effect.sourceId,fromTypes,toTypes:[...(current.types||[])],trigger});
   if(before.speciesId!==current.speciesId)events.push({kind:'abilityFormChanged',actorId:current.actorId,abilityId:effect.sourceId,fromSpeciesId:before.speciesId,toSpeciesId:current.speciesId,name:current.name,spriteKey:current.spriteKey,types:[...(current.types||[])],trigger});
  }
 }
 return {battle:next,events};
}

export function applyFormProfile(unit,effect,profile,trigger){
 if(!profile||unit.speciesId===profile.speciesId)return null;
 const snapshot=unit.buildSnapshot||{},points=snapshot.statPoints,nature=snapshot.natureId||'serious';
 if(!points)return null;
 const old={speciesId:unit.speciesId,name:unit.name,types:[...(unit.types||[])],stats:{...unit.stats},maxHp:unit.maxHp,hp:unit.hp},stats=calculateLevel50Stats(profile.baseStats,points,nature),damageTaken=Math.max(0,(unit.maxHp??unit.stats?.hp)-unit.hp);
 unit.speciesId=profile.speciesId;unit.name=profile.name||unit.name;unit.spriteKey=profile.spriteKey||profile.speciesId;unit.types=[...(profile.types||unit.types||[])];unit.stats=stats;unit.maxHp=stats.hp;unit.hp=unit.hp<=0?0:Math.max(1,stats.hp-damageTaken);
 return {kind:'abilityFormChanged',actorId:unit.actorId,abilityId:effect.sourceId,fromSpeciesId:old.speciesId,toSpeciesId:profile.speciesId,name:unit.name,spriteKey:unit.spriteKey,types:[...unit.types],hpBefore:old.hp,maxHpBefore:old.maxHp,hpAfter:unit.hp,maxHpAfter:unit.maxHp,trigger};
}

export function resolvePreMoveFormAbilities(battle,{actorId,move,calledBy=null}){
 const next=clone(battle),events=[],unit=unitById(next,actorId);if(!unit||unit.hp<=0||calledBy||unit.transformState)return {battle:next,events};
 for(const effect of abilityEffects(unit,'stance-form-change')){
  const profile=(effect.shieldMoveIds||[]).includes(move?.id)?effect.shieldForm:move?.category!=='status'?effect.attackForm:null;if(!profile)continue;
  const event=applyFormProfile(unit,effect,profile,'before-move');if(event)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id},event);
 }
 return {battle:next,events};
}

export function resolveSwitchOutAbilityForms(battle,{actorId}){
 const next=clone(battle),events=[],unit=unitById(next,actorId);if(!unit)return {battle:next,events};
 for(const effect of abilityEffects(unit,'switch-out-form-change')){if(Array.isArray(effect.fromSpeciesIds)&&!effect.fromSpeciesIds.includes(unit.speciesId))continue;const event=applyFormProfile(unit,effect,effect.form,'switch-out');if(event)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'switch-out'},event);}
 for(const effect of abilityEffects(unit,'stance-form-change')){const event=applyFormProfile(unit,effect,effect.shieldForm,'switch-out');if(event)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'switch-out'},event);}
 for(const effect of abilityEffects(unit,'field-type-change')){const state=unit.abilityState?.[`field-type:${effect.sourceId}`],desired=state?.baseForm||effect.defaultForm||(state?.baseTypes||effect.defaultTypes?{types:[...(state?.baseTypes||effect.defaultTypes)]}:null);if(!desired)continue;const before=formIdentity(unit),fromTypes=[...(unit.types||[])];applyIdentityProfile(unit,desired);if(JSON.stringify(before)===JSON.stringify(formIdentity(unit)))continue;if(JSON.stringify(fromTypes)!==JSON.stringify(unit.types||[]))events.push({kind:'abilityTypeChanged',actorId:unit.actorId,abilityId:effect.sourceId,fromTypes,toTypes:[...(unit.types||[])],trigger:'switch-out'});if(before.speciesId!==unit.speciesId)events.push({kind:'abilityFormChanged',actorId:unit.actorId,abilityId:effect.sourceId,fromSpeciesId:before.speciesId,toSpeciesId:unit.speciesId,name:unit.name,spriteKey:unit.spriteKey,types:[...(unit.types||[])],trigger:'switch-out'});}
 return {battle:next,events};
}

export function resolveEndTurnAbilityForms(battle){
 const next=clone(battle),events=[];
 for(const side of ['A','B'])for(const {unit:listed} of activeUnits(next,side)){const unit=unitById(next,listed.actorId);if(!unit||unit.hp<=0||unit.transformState)continue;for(const effect of abilityEffects(unit,'end-turn-form-toggle')){const profiles=effect.forms||{},profile=profiles[unit.speciesId];if(!profile)continue;const event=applyFormProfile(unit,effect,profile,'end-turn');if(event)events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,trigger:'end-turn'},event);}}
 return {battle:next,events};
}

export function applyDisguiseShield(battle,{targetId,damage,moveId,hit=null,ignored=false}={}){
 let next=clone(battle);const target=unitById(next,targetId);if(!target||target.hp<=0||!(damage>0)||ignored)return {battle:next,damage,shielded:false,events:[]};
 const effect=abilityEffects(target,'disguise-shield')[0];if(!effect||target.transformState)return {battle:next,damage,shielded:false,events:[]};
 target.abilityState??={};const key=`disguise:${effect.sourceId}`;if(target.abilityState[key]?.broken)return {battle:next,damage,shielded:false,events:[]};
 target.abilityState[key]={broken:true,turn:next.turn};const beforeForm=formIdentity(target);if(effect.bustedForm)applyIdentityProfile(target,effect.bustedForm);const events=[{kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId,...(hit===null?{}:{hit})},{kind:'disguiseBroken',actorId:target.actorId,abilityId:effect.sourceId,moveId,...(hit===null?{}:{hit})},...(beforeForm.speciesId!==target.speciesId?[{kind:'abilityFormChanged',actorId:target.actorId,abilityId:effect.sourceId,fromSpeciesId:beforeForm.speciesId,toSpeciesId:target.speciesId,name:target.name,spriteKey:target.spriteKey,types:[...(target.types||[])],trigger:'disguise-break'}]:[])];
 const numerator=effect.breakNumerator??1,denominator=effect.breakDenominator??8,breakDamage=numerator>0?Math.max(1,Math.floor(maxHp(target)*numerator/denominator)):0;
 if(breakDamage>0){const damaged=applyHpGroup(next,[{actorId:target.actorId,delta:-breakDamage}],`ability:${effect.sourceId}`);next=damaged.battle;events.push(...damaged.events.map(event=>event.kind==='damage'?{...event,abilityId:effect.sourceId,reason:'disguise-break'}:event));const live=unitById(next,target.actorId);if(live?.hp>0){const threshold=resolveHpThresholdItems(next,{actorIds:[target.actorId],trigger:`ability:${effect.sourceId}:break`});next=threshold.battle;events.push(...threshold.events);}}
 return {battle:next,damage:0,shielded:true,events};
}
