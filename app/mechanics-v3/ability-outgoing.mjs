import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status.mjs';
import {applyVolatileStatus} from './volatile-state.mjs';

const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind==='outgoing-secondary-effect');
const moveAlreadyHas=(mechanics,volatile)=>(mechanics?.secondaryEffects||[]).some(effect=>effect?.kind==='volatile-status'&&effect.volatile===volatile);

export function resolveOutgoingAbilitySecondaries(battle,{actorId,move,mechanics,damagedTargetIds=[]}={},runtime={}){
 let next=clone(battle);const actor=unitById(next,actorId),events=[];
 if(!actor||actor.hp<=0||!move||move.category==='status'||!damagedTargetIds?.length)return {battle:next,events};
 for(const effect of abilityEffects(actor)){
  if(effect.contactOnly&&mechanics?.contact!==true)continue;
  if(effect.skipIfMoveAlreadyHas&&moveAlreadyHas(mechanics,effect.skipIfMoveAlreadyHas))continue;
  for(const targetId of [...new Set(damagedTargetIds)]){
   const target=unitById(next,targetId);if(!target||target.hp<=0)continue;
   if(typeof runtime.nextRandom!=='function')throw new Error('outgoing-secondary-effect requires seeded nextRandom');
   if(runtime.nextRandom()>=effect.chance)continue;
   let applied;
   if(effect.status)applied=applyMajorStatus(next,{actorId,targetId,moveId:move.id,status:effect.status},runtime);
   else applied=applyVolatileStatus(next,{actorId,targetId,moveId:move.id,volatile:effect.volatile},runtime);
   next=applied.battle;
   const succeeded=applied.events.some(event=>event.kind==='statusApplied'||event.kind==='volatileApplied');
   if(succeeded)events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId,moveId:move.id});
   events.push(...applied.events.map(event=>({...event,abilityId:event.abilityId||effect.sourceId,abilityEffectId:effect.kind})));
  }
 }
 return {battle:next,events};
}
