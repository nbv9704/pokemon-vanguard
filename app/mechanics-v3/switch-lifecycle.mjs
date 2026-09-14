import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup,applySwitch} from '../rules-v3/lifecycle.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');

export function resolveSwitchOutAbilities(battle,{actorId}){
 let next=clone(battle),events=[];const initial=unitById(next,actorId);
 if(!initial||initial.hp<=0)return {battle:next,events};
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
 return {battle:next,events};
}

export function applyMechanicsSwitch(battle,side,actorId,toId){
 const preview=applySwitch(battle,side,actorId,toId);if(!preview.ok)return preview;
 const abilities=resolveSwitchOutAbilities(battle,{actorId}),switched=applySwitch(abilities.battle,side,actorId,toId);
 return {...switched,events:[...abilities.events,...switched.events]};
}
