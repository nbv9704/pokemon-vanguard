import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {calculateDamage} from '../rules-v3/damage.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {stagedStat} from '../rules-v3/stats.mjs';
import {passiveDamageModifiers,receivedDamageModifiers} from './passive-effects.mjs';
import {weatherDamageModifier} from './weather.mjs';
import {sideConditionDamageModifiers} from './side-conditions.mjs';
import {terrainDamageModifiers} from './terrain.mjs';
import {wonderRoomDefenseBase} from './rooms.mjs';
import {applySemiInvulnerabilityHitEffect,semiInvulnerabilityInteraction} from './semi-invulnerability.mjs';
import {abilityPowerModifiers,abilityStatModifiers} from './ability-hooks.mjs';
import {applySurvivalItemToMoveDamage,resolveContactDamageItems,resolvePostDamageItems} from './item-hooks.mjs';

export function applyDamageHit(battle,{actorId,targetId,move,mechanics=null,spread=false,hit=null,ignoreBurn=false},runtime){
 if(typeof runtime?.nextRandom!=='function')throw new Error('damage hit requires seeded nextRandom');
 let next=clone(battle);const actor=unitById(next,actorId),defender=unitById(next,targetId);
 if(!actor||actor.hp<=0||!defender||defender.hp<=0)return {battle:next,amount:0,events:[]};
 const physical=move.category==='physical',effectiveness=typeEffectiveness(move.type,defender.types),weatherModifier=weatherDamageModifier(next,move.type);
 if(effectiveness===0){
  const breakdown=calculateDamage({level:next.level||50,power:move.power,attack:actor.stats[physical?'atk':'spa'],defense:defender.stats[physical?'def':'spd'],moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll:100,weatherModifier,physical});
  return {battle:next,amount:0,events:[damageEvent(actor,defender,move,0,effectiveness,{...breakdown,randomApplied:false},hit)]};
 }
 const critical=runtime.nextRandom()<1/24,randomRoll=85+Math.floor(runtime.nextRandom()*16),attackKey=physical?'atk':'spa',defenseKey=physical?'def':'spd';
 const attackStage=critical&&actor.stages?.[attackKey]<0?0:actor.stages?.[attackKey]||0,defenseStage=critical&&defender.stages?.[defenseKey]>0?0:defender.stages?.[defenseKey]||0;
 const passive=passiveDamageModifiers(actor,move,next,{critical}),received=receivedDamageModifiers(defender,move,next),sideConditions=sideConditionDamageModifiers(next,defender,move,critical),terrain=terrainDamageModifiers(next,actor,defender,move),semi=semiInvulnerabilityInteraction(defender,move.id),abilityPower=abilityPowerModifiers(actor,move,mechanics),abilityStat=abilityStatModifiers(actor,attackKey,next,move),power=Math.max(1,Math.floor(abilityPower.apply(move.power)*terrain.powerModifier)),attack=abilityStat.apply(stagedStat(actor.stats[attackKey],attackStage)),damage=calculateDamage({level:next.level||50,power,attack,defense:stagedStat(wonderRoomDefenseBase(next,defender,defenseKey),defenseStage),moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll,spread,weatherModifier,critical,burned:!ignoreBurn&&(actor.status?.id||actor.status)==='burn',physical,otherModifiers:[...passive.values,...received.values,...sideConditions.values,...terrain.values,semi.multiplier]});damage.passiveModifiers=[...passive.applied,...received.applied];damage.abilityPowerModifiers=abilityPower.applied;damage.abilityStatModifiers=abilityStat.applied;damage.sideConditionModifiers=sideConditions.applied;damage.terrainModifiers=terrain.applied;if(terrain.powerModifier!==1)damage.terrainPowerModifier=terrain.powerModifier;if(semi.multiplier!==1)damage.semiInvulnerabilityModifier={mode:semi.mode,multiplier:semi.multiplier};
 const hpBefore=defender.hp,survival=applySurvivalItemToMoveDamage(next,{targetId:defender.actorId,damage:damage.damage,moveId:move.id});next=survival.battle;const liveDefender=unitById(next,defender.actorId),amount=Math.min(hpBefore,survival.damage);liveDefender.hp-=amount;
 if(survival.itemId)damage.itemSurvival={sourceKind:'item',sourceId:survival.itemId,originalDamage:damage.damage,adjustedDamage:amount};
 let events=[...survival.events,damageEvent(actor,{...liveDefender,hp:hpBefore},move,amount,damage.type,damage,hit,liveDefender.hp)];
 if(amount>0){
  if(liveDefender.hp>0){const aftermath=applySemiInvulnerabilityHitEffect(next,{targetId:liveDefender.actorId,moveId:move.id});next=aftermath.battle;events.push(...aftermath.events);}
  const contact=resolveContactDamageItems(next,{attackerId:actor.actorId,targetId:liveDefender.actorId,moveId:move.id,mechanics,damage:amount,hit});next=contact.battle;events.push(...contact.events);
 }
 const finalDefender=unitById(next,liveDefender.actorId);
 if(finalDefender?.hp===0)events.push({kind:'fainted',targetId:finalDefender.actorId,source:move.id});
 else if(amount>0){const item=resolvePostDamageItems(next,{targetId:liveDefender.actorId,moveId:move.id});next=item.battle;events.push(...item.events);}
 return {battle:next,amount,events};
}

function damageEvent(actor,defender,move,amount,effectiveness,breakdown,hit,hpAfter=defender.hp){
 return {kind:'damage',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id,hpBefore:defender.hp,hpAfter,amount,effectiveness,breakdown,...(hit===null?{}:{hit})};
}
