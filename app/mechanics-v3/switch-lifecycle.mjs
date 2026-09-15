import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup,applySwitch} from '../rules-v3/lifecycle.mjs';
import {restoreTransientAbility} from './ability-replacement.mjs';
import {resolveSwitchOutAbilityForms} from './ability-form.mjs';
import {clearIllusionState,restoreTransformState} from './ability-transform.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');

export function resolveSwitchOutAbilities(battle,{actorId,manifests=null}){
 let next=clone(battle),events=[];const initial=unitById(next,actorId);
 if(!initial||initial.hp<=0)return {battle:next,events};
 for(const effect of abilityEffects(initial).filter(effect=>effect.kind==='pre-move-type-change')){const key=`type-change:${effect.sourceId}`,state=initial.abilityState?.[key];if(!state)continue;if(Array.isArray(state.originalTypes)&&state.originalTypes.length)initial.types=[...state.originalTypes];delete initial.abilityState[key];events.push({kind:'abilityStateEnded',actorId,abilityId:effect.sourceId,state:'type-change',reason:'switch-out'});}
 for(const effect of abilityEffects(initial)){
  const unit=unitById(next,actorId);if(!unit||unit.hp<=0)break;
  if(effect.kind==='switch-out-status-cure'){
   const status=unit.status?.id||unit.status;if(!status)continue;unit.status=null;
   events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind},{kind:'statusCured',actorId,targetId:actorId,status,reason:'ability',abilityId:effect.sourceId,trigger:'switch-out'});
  }
  if(effect.kind==='switch-out-heal'){
   const limit=maxHp(unit);if(!Number.isInteger(limit)||unit.hp>=limit)continue;
   const amount=Math.max(1,Math.floor(limit*effect.numerator/effect.denominator)),healed=applyHpGroup(next,[{actorId,delta:amount}],`ability:${effect.sourceId}`);next=healed.battle;
   if(healed.events.length)events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind},...healed.events.map(event=>({...event,abilityId:effect.sourceId,trigger:'switch-out'})));
  }
 }
 const forms=resolveSwitchOutAbilityForms(next,{actorId});next=forms.battle;events.push(...forms.events);
 const current=unitById(next,actorId);if(current){events.push(...clearIllusionState(current));events.push(...restoreTransformState(current));}
 if(manifests){const restored=unitById(next,actorId);if(restored)events.push(...restoreTransientAbility(restored,manifests));}
 return {battle:next,events};
}

export function applyMechanicsSwitch(battle,side,actorId,toId,{manifests=null}={}){
 const preview=applySwitch(battle,side,actorId,toId);if(!preview.ok)return preview;
 const abilities=resolveSwitchOutAbilities(battle,{actorId,manifests}),switched=applySwitch(abilities.battle,side,actorId,toId);
 return {...switched,events:[...abilities.events,...switched.events]};
}
