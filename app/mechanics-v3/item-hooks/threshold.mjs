import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {abilityBerryEffectMultiplier} from '../ability-hooks.mjs';
import {abilityItemEffect,activateHeldItem,itemEffects,maxHp} from './state.mjs';

export function resolveHpThresholdItems(battle,{actorIds=null,trigger='state-update'}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const targetId of ids){
  const target=unitById(next,targetId);if(!target||target.hp<=0)continue;
  const effect=itemEffects(target,'item-threshold-heal',next)[0];if(!effect)continue;
  const baseNumerator=effect.thresholdNumerator??1,baseDenominator=effect.thresholdDenominator??2,modifier=effect.sourceId?.endsWith('-berry')?abilityItemEffect(target,'berry-threshold-modifier'):null;
  const useModifier=!!modifier&&modifier.numerator*baseDenominator>baseNumerator*modifier.denominator,thresholdNumerator=useModifier?modifier.numerator:baseNumerator,thresholdDenominator=useModifier?modifier.denominator:baseDenominator,baseEligible=target.hp*baseDenominator<=maxHp(target)*baseNumerator;
  if(target.hp*thresholdDenominator>maxHp(target)*thresholdNumerator)continue;
  if(useModifier&&!baseEligible)events.push({kind:'abilityTriggered',sourceId:targetId,abilityId:modifier.sourceId,effectId:modifier.kind,itemId:effect.sourceId,trigger:'berry-threshold'});
  const activated=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'hp-threshold',consume:true,activationKey:`threshold:${next.turn}:${targetId}:${effect.sourceId}:${target.hp}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,targetId),numerator=effect.healNumerator??1,denominator=effect.healDenominator??4,baseAmount=Number.isInteger(effect.healAmount)?effect.healAmount:Math.max(1,Math.floor(maxHp(current)*numerator/denominator)),berryMultiplier=effect.sourceId?.endsWith('-berry')?abilityBerryEffectMultiplier(current):1,amount=Math.max(1,Math.floor(baseAmount*berryMultiplier)),healed=applyHpGroup(next,[{actorId:targetId,delta:amount}],effect.sourceId);next=healed.battle;events.push(...healed.events.map(event=>berryMultiplier>1?{...event,abilityMultiplier:berryMultiplier}:event));
 }
 return {battle:next,events};
}
