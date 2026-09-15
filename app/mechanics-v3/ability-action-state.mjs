import {clone,unitById} from '../rules-v3/battle-state.mjs';

const abilityEffects=(unit,kind)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind===kind);

export function resolveBeforeMoveAbilityState(battle,{actorId,move}={}){
 const next=clone(battle),actor=unitById(next,actorId),events=[];if(!actor||actor.hp<=0||!move)return {battle:next,events};
 for(const effect of abilityEffects(actor,'pre-move-type-change')){
  actor.abilityState??={};const key=`type-change:${effect.sourceId}`,state=actor.abilityState[key];if(effect.oncePerSwitch&&state?.used)continue;
  const originalTypes=[...(actor.types||[])],nextTypes=[move.type];actor.types=nextTypes;actor.abilityState[key]={used:true,originalTypes};
  events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:effect.sourceId,effectId:effect.kind,moveId:move.id},{kind:'typeChanged',actorId:actor.actorId,types:nextTypes,previousTypes:originalTypes,reason:'ability',abilityId:effect.sourceId});
 }
 return {battle:next,events};
}

export function resolveAfterMoveAbilityState(battle,{actorId,move}={}){
 const next=clone(battle),actor=unitById(next,actorId),events=[];if(!actor||!move||move.category==='status')return {battle:next,events};
 for(const effect of abilityEffects(actor,'damage-charge-type')){
  const key=`charge:${effect.sourceId}`;if(move.type!==effect.type||!actor.abilityState?.[key])continue;delete actor.abilityState[key];
  events.push({kind:'abilityStateEnded',actorId:actor.actorId,abilityId:effect.sourceId,state:'charge',reason:'move-used',moveId:move.id});
 }
 return {battle:next,events};
}
