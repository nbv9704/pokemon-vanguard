import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilityVolatileBlock} from './ability-hooks.mjs';
import {resolveVolatileCureItems} from './item-hooks.mjs';

const binaryGender=gender=>gender==='male'||gender==='female';

export function infatuationCompatibility(source,target){
 if(!source||!target||!binaryGender(source.gender)||!binaryGender(target.gender)||source.gender===target.gender)return false;
 return true;
}

export function applyInfatuation(battle,{sourceId,targetId,moveId='attract',sourceAbilityId=null,ignoreTargetAbility=false}={}){
 let next=clone(battle);const source=unitById(next,sourceId),target=unitById(next,targetId),events=[];
 if(!source||!target||source.hp<=0||target.hp<=0)return {battle:next,applied:false,events};
 if(!infatuationCompatibility(source,target)){events.push({kind:'volatileFailed',actorId:source.actorId,targetId:target.actorId,moveId,volatile:'infatuation',reason:'genderMismatch',...(sourceAbilityId?{abilityId:sourceAbilityId}:{})});return {battle:next,applied:false,events};}
 target.volatiles??={};
 if(target.volatiles.infatuation){events.push({kind:'volatileFailed',actorId:source.actorId,targetId:target.actorId,moveId,volatile:'infatuation',reason:'alreadyVolatile',...(sourceAbilityId?{abilityId:sourceAbilityId}:{})});return {battle:next,applied:false,events};}
 const blocked=ignoreTargetAbility?null:abilityVolatileBlock(target,'infatuation',next);
 if(blocked){events.push({kind:'volatileFailed',actorId:source.actorId,targetId:target.actorId,moveId,volatile:'infatuation',...blocked,...(sourceAbilityId?{abilityId:sourceAbilityId}:{})});return {battle:next,applied:false,events};}
 target.volatiles.infatuation={id:'infatuation',sourceId:source.actorId,moveId,...(sourceAbilityId?{sourceAbilityId}:{})};
 events.push({kind:'volatileApplied',actorId:source.actorId,targetId:target.actorId,moveId,volatile:'infatuation',...(sourceAbilityId?{abilityId:sourceAbilityId}:{})});
 const cured=resolveVolatileCureItems(next,{actorIds:[target.actorId],trigger:`volatile-status:${sourceAbilityId?`ability:${sourceAbilityId}`:moveId}:infatuation`});next=cured.battle;events.push(...cured.events);
 return {battle:next,applied:true,events};
}
