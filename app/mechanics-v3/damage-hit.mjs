import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {calculateDamage} from '../rules-v3/damage.mjs';
import {stagedStat} from '../rules-v3/stats.mjs';
import {passiveDamageModifiers,receivedDamageModifiers} from './passive-effects.mjs';
import {defenseWithWeather,weatherDamageModifier} from './weather.mjs';
import {sideConditionDamageModifiers} from './side-conditions.mjs';
import {abilityIgnoresOpponentStage} from './ability-stage-change.mjs';
import {terrainDamageModifiers} from './terrain.mjs';
import {wonderRoomDefenseBase} from './rooms.mjs';
import {applySemiInvulnerabilityHitEffect,semiInvulnerabilityInteraction} from './semi-invulnerability.mjs';
import {abilityCriticalRatioStages,abilityForcesCritical,abilityIgnoresBurnAttackPenalty,abilityPowerModifiers,abilityPreventsCritical,abilityStabModifier,abilityStatModifiers,allyReceivedDamageModifiers} from './ability-hooks.mjs';
import {resolveContactAbilityResponses} from './ability-contact.mjs';
import {applyLethalHitSurvivalAbility,resolveDamageResponseAbilities,resolveKoAbilityEffects} from './ability-damage-response.mjs';
import {resolveAllyFaintAbilityCopies} from './ability-replacement.mjs';
import {applyResistanceBerryToMoveDamage,applySurvivalItemToMoveDamage,criticalChanceWithHeldItems,resolveContactDamageItems,resolvePostDamageItems,statWithHeldItems,typeEffectivenessWithHeldItems} from './item-hooks.mjs';
import {opponentAbilitiesIgnoredFor} from './ability-targeting.mjs';
import {applyDisguiseShield} from './ability-form.mjs';
import {applySubstituteDamage,substituteBypassed} from './substitute.mjs';
import {breakIllusionOnDamage} from './ability-transform.mjs';

const pokeRound=value=>value%1>.5?Math.ceil(value):Math.floor(value);

export function applyDamageHit(battle,{actorId,targetId,move,mechanics=null,spread=false,hit=null,ignoreBurn=false,moveItemMultiplier=1,moveItemId=null},runtime){
 if(typeof runtime?.nextRandom!=='function')throw new Error('damage hit requires seeded nextRandom');
 let next=clone(battle);const actor=unitById(next,actorId),defender=unitById(next,targetId);
 if(!actor||actor.hp<=0||!defender||defender.hp<=0)return {battle:next,amount:0,events:[]};
 const ignoreTargetAbility=opponentAbilitiesIgnoredFor(next,actorId,targetId,mechanics),physical=move.category==='physical',effectiveness=typeEffectivenessWithHeldItems(move.type,defender,next,{attacker:actor,ignoreDefenderAbility:ignoreTargetAbility}),weatherModifier=weatherDamageModifier(next,move.type);
 if(effectiveness===0){
  const breakdown=calculateDamage({level:next.level||50,power:move.power,attack:actor.stats[physical?'atk':'spa'],defense:defender.stats[physical?'def':'spd'],moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll:100,weatherModifier,physical,typeModifier:effectiveness});
  return {battle:next,amount:0,events:[damageEvent(actor,defender,move,0,effectiveness,{...breakdown,randomApplied:false},hit)]};
 }
 const hitsSubstitute=Boolean(defender.volatiles?.substitute&&!substituteBypassed(actor,mechanics));
 const resistance=hitsSubstitute?{battle:next,multiplier:1,events:[]} : applyResistanceBerryToMoveDamage(next,{targetId:defender.actorId,moveType:move.type,effectiveness,moveId:move.id,hit});next=resistance.battle;
 const liveActor=unitById(next,actorId),liveTarget=unitById(next,targetId),criticalRoll=runtime.nextRandom(),critical=!(ignoreTargetAbility?false:abilityPreventsCritical(liveTarget))&&(abilityForcesCritical(liveActor,liveTarget)||criticalRoll<criticalChanceWithHeldItems(liveActor,next,{baseStage:abilityCriticalRatioStages(liveActor)})),randomRoll=85+Math.floor(runtime.nextRandom()*16),attackKey=physical?'atk':'spa',defenseKey=physical?'def':'spd';
 const rawAttackStage=critical&&liveActor.stages?.[attackKey]<0?0:liveActor.stages?.[attackKey]||0,rawDefenseStage=critical&&liveTarget.stages?.[defenseKey]>0?0:liveTarget.stages?.[defenseKey]||0,attackStage=!ignoreTargetAbility&&abilityIgnoresOpponentStage(liveTarget,attackKey,'defending')?0:rawAttackStage,defenseStage=abilityIgnoresOpponentStage(liveActor,defenseKey,'attacking')?0:rawDefenseStage;
 const passive=passiveDamageModifiers(liveActor,move,next,{critical,effectiveness}),received=receivedDamageModifiers(liveTarget,move,next,{effectiveness,ignoreAbility:ignoreTargetAbility}),allyReceived=allyReceivedDamageModifiers(next,liveTarget,liveActor,{ignoreAbilities:ignoreTargetAbility}),sideConditions=sideConditionDamageModifiers(next,liveTarget,move,critical,liveActor),terrain=terrainDamageModifiers(next,liveActor,liveTarget,move),semi=semiInvulnerabilityInteraction(liveTarget,move.id),abilityPower=abilityPowerModifiers(liveActor,move,mechanics,{battle:next,runtime,target:liveTarget}),abilityStat=abilityStatModifiers(liveActor,attackKey,next,move),abilityDefense=abilityStatModifiers(liveTarget,defenseKey,next,move,{ignoreAbility:ignoreTargetAbility}),abilityPowerValue=abilityPower.apply(move.power),itemPowerValue=moveItemMultiplier===1?abilityPowerValue:Math.max(1,pokeRound(abilityPowerValue*moveItemMultiplier)),power=Math.max(1,Math.floor(itemPowerValue*terrain.powerModifier)),stagedAttack=stagedStat(liveActor.stats[attackKey],attackStage),attack=statWithHeldItems(abilityStat.apply(stagedAttack),liveActor,attackKey,next),baseDefense=stagedStat(wonderRoomDefenseBase(next,liveTarget,defenseKey),defenseStage),abilityDefenseValue=abilityDefense.apply(baseDefense),defense=defenseWithWeather(abilityDefenseValue,liveTarget,defenseKey,next),damage=calculateDamage({level:next.level||50,power,attack,defense,moveType:move.type,attackerTypes:liveActor.types,defenderTypes:liveTarget.types,typeModifier:effectiveness,randomRoll,spread,weatherModifier,critical,burned:!ignoreBurn&&!abilityIgnoresBurnAttackPenalty(liveActor)&&(liveActor.status?.id||liveActor.status)==='burn',physical,stabModifier:abilityStabModifier(liveActor,move),otherModifiers:[...passive.values,...received.values,...allyReceived.values,...sideConditions.values,...terrain.values,semi.multiplier,resistance.multiplier]});
 damage.passiveModifiers=[...passive.applied,...received.applied,...allyReceived.applied];damage.abilityPowerModifiers=abilityPower.applied;damage.abilityStatModifiers=[...abilityStat.applied,...abilityDefense.applied];damage.abilityDefenseModifiers=abilityDefense.applied;damage.sideConditionModifiers=sideConditions.applied;damage.terrainModifiers=terrain.applied;if(defense!==abilityDefenseValue)damage.weatherDefenseModifier={weather:next.field?.weather?.id,stat:defenseKey,multiplier:defense/abilityDefenseValue};if(terrain.powerModifier!==1)damage.terrainPowerModifier=terrain.powerModifier;if(semi.multiplier!==1)damage.semiInvulnerabilityModifier={mode:semi.mode,multiplier:semi.multiplier};if(resistance.itemId)damage.itemResistance={sourceKind:'item',sourceId:resistance.itemId,multiplier:resistance.multiplier};if(moveItemId&&moveItemMultiplier!==1)damage.itemMovePowerModifier={sourceKind:'item',sourceId:moveItemId,multiplier:moveItemMultiplier};
 if(hitsSubstitute){const sub=applySubstituteDamage(next,{actorId,targetId,damage:damage.damage,moveId:move.id,mechanics,hit});return {battle:sub.battle,amount:sub.amount,substituteAbsorbed:sub.absorbed,events:[...sub.events]};}
 const disguise=applyDisguiseShield(next,{targetId,damage:damage.damage,moveId:move.id,hit,ignored:ignoreTargetAbility});if(disguise.shielded)return {battle:disguise.battle,amount:0,disguiseShielded:true,events:disguise.events};next=disguise.battle;
 const targetBeforeSurvival=unitById(next,targetId);if(!targetBeforeSurvival||targetBeforeSurvival.hp<=0)return {battle:next,amount:0,disguiseShielded:true,events:disguise.events};
 const hpBefore=targetBeforeSurvival.hp,abilitySurvival=applyLethalHitSurvivalAbility(next,{targetId:targetBeforeSurvival.actorId,damage:damage.damage,moveId:move.id,hit,ignoreAbility:ignoreTargetAbility});next=abilitySurvival.battle;
 const survival=applySurvivalItemToMoveDamage(next,{targetId:targetBeforeSurvival.actorId,damage:abilitySurvival.damage,moveId:move.id,hit,runtime});next=survival.battle;const liveDefender=unitById(next,targetBeforeSurvival.actorId),amount=Math.min(hpBefore,survival.damage);liveDefender.hp-=amount;
 if(abilitySurvival.abilityId)damage.abilitySurvival={sourceKind:'ability',sourceId:abilitySurvival.abilityId,originalDamage:damage.damage,adjustedDamage:abilitySurvival.damage};
 if(survival.itemId)damage.itemSurvival={sourceKind:'item',sourceId:survival.itemId,originalDamage:abilitySurvival.damage,adjustedDamage:amount};
 let events=[...resistance.events,...abilitySurvival.events,...survival.events,damageEvent(liveActor,{...liveDefender,hp:hpBefore},move,amount,damage.type,damage,hit,liveDefender.hp)];
 if(amount>0){const illusion=breakIllusionOnDamage(next,{targetId:liveDefender.actorId,sourceId:liveActor.actorId,moveId:move.id});next=illusion.battle;events.push(...illusion.events);}
 if(amount>0){
  const response=resolveDamageResponseAbilities(next,{actorId:liveActor.actorId,targetId:liveDefender.actorId,move,damage:amount,hpBefore,hpAfter:liveDefender.hp,breakdown:damage,ignoreTargetAbility},runtime);next=response.battle;events.push(...response.events);
  const currentDefender=unitById(next,liveDefender.actorId);
  if(currentDefender?.hp>0){const aftermath=applySemiInvulnerabilityHitEffect(next,{targetId:currentDefender.actorId,moveId:move.id});next=aftermath.battle;events.push(...aftermath.events);}
  const abilityContact=resolveContactAbilityResponses(next,{attackerId:liveActor.actorId,targetId:liveDefender.actorId,moveId:move.id,mechanics,damage:amount,hit,ignoreTargetAbility},runtime);next=abilityContact.battle;events.push(...abilityContact.events);
  const contact=resolveContactDamageItems(next,{attackerId:liveActor.actorId,targetId:liveDefender.actorId,moveId:move.id,mechanics,damage:amount,hit});next=contact.battle;events.push(...contact.events);
 }
 if(amount>0){const item=resolvePostDamageItems(next,{targetId:liveDefender.actorId,moveId:move.id,damage:amount});next=item.battle;events.push(...item.events);}
 const finalDefender=unitById(next,liveDefender.actorId);
 if(finalDefender?.hp===0){const ko=resolveKoAbilityEffects(next,{actorId:liveActor.actorId,targetId:finalDefender.actorId,moveId:move.id});next=ko.battle;events.push(...ko.events);if(runtime?.abilityManifests){const copied=resolveAllyFaintAbilityCopies(next,{faintedId:finalDefender.actorId,manifests:runtime.abilityManifests});next=copied.battle;events.push(...copied.events);}events.push({kind:'fainted',targetId:finalDefender.actorId,source:move.id});}
 return {battle:next,amount,events};
}

function damageEvent(actor,defender,move,amount,effectiveness,breakdown,hit,hpAfter=defender.hp){
 return {kind:'damage',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id,hpBefore:defender.hp,hpAfter,amount,effectiveness,breakdown,...(hit===null?{}:{hit})};
}
