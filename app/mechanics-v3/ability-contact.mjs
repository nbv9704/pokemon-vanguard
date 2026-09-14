import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {applyMajorStatus} from './major-status-state.mjs';
import {abilityStatDropBlock} from './ability-hooks.mjs';
import {resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {resolveNegativeStageResetItems} from './item-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const clampStage=value=>Math.max(-6,Math.min(6,value));
const contactEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability'&&effect.kind==='contact-response');

export function resolveContactAbilityResponses(battle,{attackerId,targetId,moveId,mechanics,damage=0,hit=null}={},runtime={}){
 let next=clone(battle),events=[];if(!mechanics?.contact||damage<=0)return {battle:next,events};
 for(const effect of contactEffects(unitById(next,targetId))){
  const attacker=unitById(next,attackerId),holder=unitById(next,targetId);if(!attacker||!holder)break;
  if(effect.chance!==undefined&&effect.chance<1){if(typeof runtime.nextRandom!=='function')throw new Error('contact Ability response requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance)continue;}
  events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:attacker.actorId,...(hit===null?{}:{hit})});
  if(effect.response==='damage'){
   if(attacker.hp<=0)continue;const amount=Math.max(1,Math.floor(maxHp(attacker)*effect.numerator/effect.denominator));const applied=applyHpGroup(next,[{actorId:attacker.actorId,delta:-amount}],`ability:${effect.sourceId}`);next=applied.battle;events.push(...applied.events.map(event=>({...event,actorId:holder.actorId,abilityId:effect.sourceId,reason:'contact'})));continue;
  }
  if(effect.response==='status'){
   if(attacker.hp<=0)continue;const applied=applyMajorStatus(next,{actorId:holder.actorId,targetId:attacker.actorId,moveId:`ability:${effect.sourceId}`,status:effect.status},runtime);next=applied.battle;events.push(...applied.events.map(event=>({...event,abilityId:effect.sourceId,reason:event.reason||'contact'})));continue;
  }
  if(effect.response==='stat'){
   if(attacker.hp<=0)continue;attacker.stages??={};const stat=effect.stat,requestedDelta=effect.stages,block=abilityStatDropBlock(attacker,{battle:next,sourceId:holder.actorId,stat,requestedDelta});
   if(block){events.push({kind:'statStageBlocked',actorId:holder.actorId,targetId:attacker.actorId,abilityId:effect.sourceId,stat,requestedDelta,trigger:'contact',...block});continue;}
   const before=Number.isInteger(attacker.stages[stat])?attacker.stages[stat]:0,after=clampStage(before+requestedDelta),appliedDelta=after-before;attacker.stages[stat]=after;const change={kind:'statStageChanged',actorId:holder.actorId,targetId:attacker.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'contact'};events.push(change);
   const response=resolveStatDropResponseAbilities(next,{sourceId:holder.actorId,targetId:attacker.actorId,changes:[change],trigger:'contact'});next=response.battle;events.push(...response.events);
   const reset=resolveNegativeStageResetItems(next,{actorIds:[attacker.actorId],trigger:`ability:${effect.sourceId}:contact-stat-change`});next=reset.battle;events.push(...reset.events);
  }
 }
 return {battle:next,events};
}
