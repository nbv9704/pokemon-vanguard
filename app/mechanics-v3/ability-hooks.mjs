import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {effectiveWeatherId} from './ability-field.mjs';
import {resolveOpponentStatGainCopyAbilities,resolveStatDropResponseAbilities} from './ability-stage-response.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const tagsOf=mechanics=>new Set(mechanics?.tags||[]);
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const activeSideUnits=(battle,side)=>side?activeUnits(battle,side).map(entry=>entry.unit):[];
const activeAllies=(battle,unit)=>activeSideUnits(battle,sideOf(battle,unit?.actorId)).filter(ally=>ally.actorId!==unit.actorId);
const targetTypeMatches=(effect,target)=>!(effect.targetTypes||[]).length||(target?.types||[]).some(type=>effect.targetTypes.includes(type));
const pokeRound=value=>value%1>.5?Math.ceil(value):Math.floor(value);
const suppressibleSecondaryCount=mechanics=>(Array.isArray(mechanics?.secondaryEffects)?mechanics.secondaryEffects.length:0)+(Array.isArray(mechanics?.handlers)?mechanics.handlers.filter(handler=>handler?.params?.suppressibleSecondary===true).length:0);

export function modifyMoveByAbility(unit,move,mechanics,{priority=null,turnOrderAbilityIds=[]}={}){
 const nextMove=structuredClone(move),nextMechanics=structuredClone(mechanics),applied=[],tags=tagsOf(nextMechanics);
 if(Number.isInteger(priority))nextMechanics.priority=priority;
 if(Array.isArray(turnOrderAbilityIds)&&turnOrderAbilityIds.length)nextMechanics.turnOrderAbilityIds=[...turnOrderAbilityIds];
 for(const effect of abilityEffects(unit)){
  if(effect.kind==='move-type-by-tag'&&tags.has(effect.tag)&&nextMove.type!==effect.type){
   const fromType=nextMove.type;nextMove.type=effect.type;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,fromType,toType:effect.type});
  }
  if(effect.kind==='move-type-conversion'&&nextMove.type===effect.fromType){
   const fromType=nextMove.type;nextMove.type=effect.toType;nextMechanics.abilityTypeConversion={sourceId:effect.sourceId,multiplier:effect.multiplier,fromType,toType:effect.toType};applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,fromType,toType:effect.toType,multiplier:effect.multiplier});
  }
  if(effect.kind==='secondary-effect-power-boost'){
   const suppressedSecondaries=suppressibleSecondaryCount(nextMechanics);if(suppressedSecondaries){nextMechanics.secondaryEffectsSuppressed=true;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier,suppressedSecondaries});}
  }
  if(effect.kind==='remove-contact'&&nextMechanics.contact){
   nextMechanics.contact=false;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind});
  }
  if(effect.kind==='redirection-bypass'&&nextMechanics.redirectable!==false){nextMechanics.redirectable=false;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind});}
  if(effect.kind==='opponent-ability-bypass'){nextMechanics.opponentAbilitiesIgnored=true;nextMechanics.abilityBypassSourceId=effect.sourceId;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind});}
 }
 return {move:nextMove,mechanics:nextMechanics,applied};
}

export function resolveTargetAbilityBlock(battle,{actorId,targetId,move,mechanics}){
 const next=clone(battle),target=unitById(next,targetId);if(!target||target.hp<=0||target.actorId===actorId)return {battle:next,blocked:false,events:[]};
 const tags=tagsOf(mechanics),actorSide=sideOf(next,actorId),targetSide=sideOf(next,targetId);
 const actor=unitById(next,actorId),orderIds=new Set(mechanics?.turnOrderAbilityIds||[]);
 for(const effect of abilityEffects(actor))if(actorSide&&targetSide&&actorSide!==targetSide&&effect.kind==='turn-order-modifier'&&orderIds.has(effect.sourceId)&&(effect.blockedTargetTypes||[]).some(type=>(target.types||[]).includes(type)))return blockedByActorAbility(next,target,actorId,move,effect);
 if(actorSide&&targetSide&&actorSide!==targetSide&&(mechanics?.priority||0)>0){
  for(const holder of activeSideUnits(next,targetSide)){
   const effect=abilityEffects(holder).find(effect=>effect.kind==='priority-move-immunity-aura');
   if(effect)return blockedByHolder(next,target,holder,actorId,move,effect);
  }
 }
 for(const effect of abilityEffects(target)){
  if(effect.kind==='move-tag-immunity'&&tags.has(effect.tag))return blocked(next,target,actorId,move,effect,false);
  if(effect.kind==='ally-damage-immunity'&&actorSide&&actorSide===targetSide&&move.category!=='status')return blocked(next,target,actorId,move,effect,false);
  if(effect.kind==='type-immunity-boost'&&move.type===effect.type){
   target.volatiles??={};const stateKey=effect.stateKey||effect.sourceId,activated=!target.volatiles[stateKey];
   target.volatiles[stateKey]={id:stateKey,sourceAbilityId:effect.sourceId};
   return blocked(next,target,actorId,move,effect,activated);
  }
  if(effect.kind==='type-immunity-response'&&move.type===effect.type)return blockedWithResponse(next,target,actorId,move,effect);
 }
 return {battle:next,blocked:false,events:[]};
}

function blocked(battle,target,actorId,move,effect,activated){
 return {battle,blocked:true,events:[
  {kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,...(activated?{activated:true}:{})},
  {kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'abilityImmune',abilityId:effect.sourceId}
 ]};
}

function blockedByActorAbility(battle,target,actorId,move,effect){
 return {battle,blocked:true,events:[
  {kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:target.actorId},
  {kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'abilityTargetImmune',abilityId:effect.sourceId,sourceId:actorId}
 ]};
}

function blockedByHolder(battle,target,holder,actorId,move,effect){
 return {battle,blocked:true,events:[
  {kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:target.actorId},
  {kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'priorityAbility',abilityId:effect.sourceId,sourceId:holder.actorId}
 ]};
}

function blockedWithResponse(battle,target,actorId,move,effect){
 const events=[{kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind}];
 if(effect.response==='heal'){
  const before=target.hp,limit=maxHp(target),amount=Math.max(1,Math.floor(limit*effect.numerator/effect.denominator)),after=Math.min(limit,before+amount);target.hp=after;
  if(after>before)events.push({kind:'heal',targetId:target.actorId,hpBefore:before,hpAfter:after,amount:after-before,source:`ability:${effect.sourceId}`,abilityId:effect.sourceId});
 }
 if(effect.response==='stat'){
  target.stages??={};const stat=effect.stat,changed=abilityStageChange(target,effect.stages),requestedDelta=changed.requestedDelta,before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=Math.max(-6,Math.min(6,before+requestedDelta)),appliedDelta=after-before;target.stages[stat]=after;
  if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
  const change={kind:'statStageChanged',actorId:target.actorId,targetId:target.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'type-immunity'};events.push(change);
  const copied=resolveOpponentStatGainCopyAbilities(battle,{targetId:target.actorId,changes:[change],trigger:'type-immunity'});battle=copied.battle;events.push(...copied.events);target=unitById(battle,target.actorId);
 }
 events.push({kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'abilityImmune',abilityId:effect.sourceId});
 return {battle,blocked:true,events};
}

export function abilityPowerModifiers(unit,move,mechanics,{battle=null,runtime=null,target=null}={}){
 const values=[],applied=[],tags=tagsOf(mechanics),hasRecoil=Array.isArray(mechanics?.handlers)&&mechanics.handlers.some(handler=>handler?.id==='apply-recoil');
 for(const effect of abilityEffects(unit)){
  let active=false,multiplier=effect.multiplier;
  if(effect.kind==='base-power-threshold-boost')active=Number.isFinite(move.power)&&move.power<=effect.maxPower;
  if(effect.kind==='move-tag-power-boost')active=tags.has(effect.tag);
  if(effect.kind==='secondary-effect-power-boost')active=suppressibleSecondaryCount(mechanics)>0;
  if(effect.kind==='contact-power-boost')active=mechanics?.contact===true;
  if(effect.kind==='recoil-power-boost')active=hasRecoil;
  if(effect.kind==='move-type-conversion')active=mechanics?.abilityTypeConversion?.sourceId===effect.sourceId;
  if(effect.kind==='late-move-power-boost'&&battle&&typeof runtime?.willMove==='function')active=target?runtime.willMove(target.actorId)===false:['A','B'].flatMap(side=>activeUnits(battle,side)).every(entry=>entry.actorId===unit.actorId||runtime.willMove(entry.actorId)===false);
  if(effect.kind==='damage-charge-type'&&move?.category!=='status'&&move?.type===effect.type)active=Boolean(unit?.abilityState?.[`charge:${effect.sourceId}`]);
  if(effect.kind==='entry-fainted-ally-power-boost'){
   const count=unit?.abilityState?.[`fainted-allies:${effect.sourceId}`]?.count??0;if(count>0){active=true;multiplier=1+effect.increment*Math.min(effect.maxCount,count);}
  }
  if(effect.kind==='gender-damage-modifier'&&target){const userGender=unit?.gender,targetGender=target?.gender;if(['male','female'].includes(userGender)&&['male','female'].includes(targetGender)){active=true;multiplier=userGender===targetGender?effect.sameGenderMultiplier:effect.oppositeGenderMultiplier;}}
  if(!active)continue;values.push(multiplier);applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier});
 }
 return {values,applied,apply(power){let next=power;for(const multiplier of values)next=Math.max(1,pokeRound(next*multiplier));return next;}};
}

export function abilityStatModifiers(unit,stat,battle,move=null,{ignoreAbility=false}={}){
 if(ignoreAbility)return {values:[],applied:[],apply:value=>value};
 const weather=effectiveWeatherId(battle),terrain=battle.field?.terrain?.id,allies=activeAllies(battle,unit),applied=abilityEffects(unit).filter(effect=>(effect.kind==='item-loss-speed-boost'&&stat==='spe'&&unit?.itemState?.consumed===true)||(effect.kind==='weather-stat-boost'&&effect.stat===stat&&effect.weather===weather)||(effect.kind==='type-immunity-boost'&&['atk','spa'].includes(stat)&&move?.type===effect.type&&Boolean(unit.volatiles?.[effect.stateKey||effect.sourceId]))||(effect.kind==='stat-multiplier'&&effect.stat===stat&&(!effect.requireStatus||Boolean(unit.status))&&(!effect.terrain||effect.terrain===terrain))||(effect.kind==='ally-ability-stat-multiplier'&&effect.stat===stat&&allies.some(ally=>abilityEffects(ally).some(allyEffect=>(effect.allyAbilities||[]).includes(allyEffect.sourceId)))));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(effect=>({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier})),apply(value){let next=value;for(const effect of applied)next=Math.max(1,Math.floor(next*effect.multiplier));return next;}};
}

export function abilityOutgoingAccuracyModifier(unit,move=null){
 const effects=abilityEffects(unit).filter(effect=>effect.kind==='outgoing-accuracy-modifier'&&(!effect.category||effect.category===move?.category));return effects.reduce((value,effect)=>value*effect.multiplier,1);
}

export function abilityForcesHit(unit){return abilityEffects(unit).some(effect=>effect.kind==='always-hit');}
export function abilityIgnoresBurnAttackPenalty(unit){return abilityEffects(unit).some(effect=>effect.kind==='burn-attack-penalty-immunity');}
export function abilityIgnoresParalysisSpeedPenalty(unit){return abilityEffects(unit).some(effect=>effect.kind==='paralysis-speed-penalty-immunity');}
export function abilityMaximizesMultiHit(unit){return abilityEffects(unit).some(effect=>effect.kind==='multi-hit-max');}
export function abilityParentalBond(unit){return abilityEffects(unit).find(effect=>effect.kind==='parental-bond')||null;}
export function abilityProtectionPierce(unit,mechanics){return mechanics?.contact===true&&mechanics?.bypassesProtect!==true?abilityEffects(unit).find(effect=>effect.kind==='contact-protection-pierce')||null:null;}
export function opponentSwitchTrap(battle,unit){
 const side=sideOf(battle,unit?.actorId);if(!side)return null;const opposing=side==='A'?'B':'A';
 for(const holder of activeSideUnits(battle,opposing)){const effect=abilityEffects(holder).find(entry=>entry.kind==='opponent-switch-trap');if(!effect)continue;if((effect.exemptTypes||[]).some(type=>(unit.types||[]).includes(type)))continue;if(effect.exemptSameAbility&&abilityEffects(unit).some(entry=>entry.sourceId===effect.sourceId))continue;return {holder,effect};}
 return null;
}
export function abilityBlocksSecondaryEffects(unit){return abilityEffects(unit).some(effect=>effect.kind==='secondary-effect-immunity');}
export function abilityBerryConsumptionHeal(unit){return abilityEffects(unit).find(effect=>effect.kind==='berry-consumption-heal')||null;}
export function abilityBerryEffectMultiplier(unit){return abilityEffects(unit).find(effect=>effect.kind==='berry-effect-multiplier')?.multiplier??1;}
export function globalMoveAbilityBlock(battle,moveId){
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){const effect=abilityEffects(unit).find(effect=>effect.kind==='global-move-block'&&(effect.moveIds||[]).includes(moveId));if(effect)return {holder:unit,effect};}
 return null;
}
export function globalContactFaintResponseBlock(battle){
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){const effect=abilityEffects(unit).find(effect=>effect.kind==='global-move-block'&&effect.blockContactFaintResponse===true);if(effect)return {holder:unit,effect};}
 return null;
}
export function abilitySleepCounterRate(unit){return abilityEffects(unit).find(effect=>effect.kind==='sleep-counter-rate')?.rate??1;}
export function abilityStatDropReflection(target,{battle=null,sourceId,requestedDelta}={}){
 if(!target||!battle||!sourceId||sourceId===target.actorId||!(requestedDelta<0))return null;
 const sourceSide=sideOf(battle,sourceId),targetSide=sideOf(battle,target.actorId);if(!sourceSide||!targetSide||sourceSide===targetSide)return null;
 return abilityEffects(target).find(effect=>effect.kind==='stat-drop-reflect')||null;
}
export function applyAbilityStatDropReflection(battle,{sourceId,targetId,sourceAbilityId=null,stat,requestedDelta,moveId=null,trigger='stat-drop'}={}){
 let next=clone(battle);const target=unitById(next,targetId),effect=abilityStatDropReflection(target,{battle:next,sourceId,requestedDelta});if(!effect)return {battle:next,reflected:false,events:[],resetActorIds:[]};
 const source=unitById(next,sourceId),events=[{kind:'abilityTriggered',sourceId:targetId,abilityId:effect.sourceId,effectId:effect.kind,targetId:sourceId,trigger}];if(!source||source.hp<=0)return {battle:next,reflected:true,events,resetActorIds:[]};
 const changed=abilityStageChange(source,requestedDelta),reflectedDelta=changed.requestedDelta;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:source.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});
 const block=abilityStatDropBlock(source,{battle:next,sourceId:targetId,sourceAbilityId:effect.sourceId,stat,requestedDelta:reflectedDelta});if(block){events.push({kind:'statStageBlocked',actorId:targetId,targetId:sourceId,...(moveId?{moveId}:{}),stat,requestedDelta:reflectedDelta,originalRequestedDelta:changed.originalRequestedDelta,reflected:true,reflectionAbilityId:effect.sourceId,...block});return {battle:next,reflected:true,events,resetActorIds:[sourceId]};}
 source.stages??={};const before=Number.isInteger(source.stages[stat])?source.stages[stat]:0,after=Math.max(-6,Math.min(6,before+reflectedDelta)),appliedDelta=after-before;source.stages[stat]=after;const change={kind:'statStageChanged',actorId:targetId,targetId:sourceId,...(moveId?{moveId}:{}),abilityId:effect.sourceId,stat,before,after,requestedDelta:reflectedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger,reflected:true};events.push(change);
 const response=resolveStatDropResponseAbilities(next,{sourceId:targetId,targetId:sourceId,changes:[change],trigger:`${trigger}:reflected`});next=response.battle;events.push(...response.events);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:sourceId,changes:[change],trigger:`${trigger}:reflected`});next=copied.battle;events.push(...copied.events);return {battle:next,reflected:true,events,resetActorIds:[sourceId]};
}

export function abilityStatDropBlock(target,{battle=null,sourceId,sourceAbilityId=null,stat,requestedDelta}={}){
 if(!target||!sourceId||sourceId===target.actorId||!(requestedDelta<0))return null;
 const effect=abilityEffects(target).find(effect=>effect.kind==='stat-drop-immunity'&&(!(effect.stats||[]).length||effect.stats.includes(stat))&&(!(effect.sourceAbilities||[]).length||effect.sourceAbilities.includes(sourceAbilityId)));
 if(effect)return {reason:'abilityBlocked',sourceAbilityId:effect.sourceId};
 const targetSide=battle&&sideOf(battle,target.actorId);
 for(const holder of activeSideUnits(battle,targetSide)){
  const aura=abilityEffects(holder).find(effect=>effect.kind==='ally-stat-drop-immunity'&&targetTypeMatches(effect,target));
  if(aura)return {reason:'abilityBlocked',sourceAbilityId:aura.sourceId,sourceActorId:holder.actorId};
 }
 return null;
}

export function abilityVolatileBlock(target,volatile,battle=null){
 const effect=abilityEffects(target).find(effect=>effect.kind==='volatile-immunity'&&(effect.volatiles||[]).includes(volatile));
 if(effect)return {reason:'abilityBlocked',sourceAbilityId:effect.sourceId,sourceActorId:target.actorId};
 const targetSide=battle&&sideOf(battle,target?.actorId);
 for(const holder of activeSideUnits(battle,targetSide)){
  const aura=abilityEffects(holder).find(effect=>effect.kind==='ally-volatile-immunity'&&(effect.volatiles||[]).includes(volatile));
  if(aura)return {reason:'abilityBlocked',sourceAbilityId:aura.sourceId,sourceActorId:holder.actorId};
 }
 return null;
}

export function abilitySuppressesHeldItems(unit){return abilityEffects(unit).some(effect=>effect.kind==='held-item-suppression');}
export function abilityPreventsIndirectDamage(unit){return abilityEffects(unit).find(effect=>effect.kind==='indirect-damage-immunity')||null;}
export function abilityGroundingImmunity(unit){return abilityEffects(unit).find(effect=>effect.kind==='grounding-immunity')||null;}
export function abilitySideConditionBypass(unit,condition){return abilityEffects(unit).find(effect=>effect.kind==='side-condition-bypass'&&(effect.conditions||[]).includes(condition))||null;}
export function abilityTypeImmunityBypass(unit,attackType,target){return abilityEffects(unit).find(effect=>effect.kind==='type-immunity-bypass'&&(effect.attackTypes||[]).includes(attackType)&&(target?.types||[]).some(type=>(effect.targetTypes||[]).includes(type)))||null;}
export function opposingBerrySuppression(battle,unit){
 const unitSide=sideOf(battle,unit?.actorId);if(!unitSide)return null;const opposing=unitSide==='A'?'B':'A';
 for(const holder of activeSideUnits(battle,opposing)){const effect=abilityEffects(holder).find(effect=>effect.kind==='opponent-berry-suppression');if(effect)return {effect,holder};}
 return null;
}
export function turnOrderAbilityEffects(unit){return abilityEffects(unit).filter(effect=>effect.kind==='turn-order-modifier');}

export function abilityForcesCritical(unit,target){
 const status=target?.status?.id||target?.status;
 return Boolean(status)&&abilityEffects(unit).some(effect=>effect.kind==='critical-vs-status'&&(effect.statuses||[]).includes(status));
}

export function abilityStatusResidualHeal(unit,status){return abilityEffects(unit).find(effect=>effect.kind==='status-residual-heal'&&(effect.statuses||[]).includes(status))||null;}
export function abilityStatusReflect(unit,status){return abilityEffects(unit).find(effect=>effect.kind==='status-reflect'&&(effect.statuses||[]).includes(status))||null;}

export function allyReceivedDamageModifiers(battle,target,actor,{ignoreAbilities=false}={}){
 if(ignoreAbilities)return {values:[],applied:[]};
 const targetSide=sideOf(battle,target?.actorId),actorSide=sideOf(battle,actor?.actorId);if(!targetSide||targetSide===actorSide)return {values:[],applied:[]};
 const applied=activeAllies(battle,target).flatMap(ally=>abilityEffects(ally).filter(effect=>effect.kind==='ally-damage-reduction').map(effect=>({...effect,holderId:ally.actorId})));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(effect=>({sourceKind:'ability',sourceId:effect.sourceId,holderId:effect.holderId,kind:effect.kind,multiplier:effect.multiplier}))};
}

export function abilityIncomingAccuracyModifier(target,battle,{ignoreAbility=false}={}){
 if(ignoreAbility)return 1;
 const weather=effectiveWeatherId(battle),volatileIds=new Set(Object.keys(target?.volatiles||{}));
 const effects=abilityEffects(target).filter(effect=>(effect.kind==='weather-incoming-accuracy-modifier'&&effect.weather===weather)||(effect.kind==='volatile-incoming-accuracy-modifier'&&volatileIds.has(effect.volatile)));
 return effects.reduce((value,effect)=>value*effect.multiplier,1);
}

export function abilityStatusBlock(battle,target,status,{sourceId=null}={}){
 const weather=effectiveWeatherId(battle);
 const effect=abilityEffects(target).find(effect=>(effect.kind==='weather-status-immunity'&&effect.weather===weather&&(effect.statuses||[]).includes(status))||(effect.kind==='major-status-immunity'&&(effect.statuses||[]).includes(status)));
 if(effect)return {reason:'abilityBlocked',sourceAbilityId:effect.sourceId,sourceActorId:target.actorId};
 const targetSide=sideOf(battle,target?.actorId);
 for(const holder of activeSideUnits(battle,targetSide)){
  const aura=abilityEffects(holder).find(effect=>effect.kind==='ally-major-status-immunity'&&(effect.statuses||[]).includes(status)&&targetTypeMatches(effect,target)&&(!effect.otherPokemonOnly||sourceId!==target.actorId));
  if(aura)return {reason:'abilityBlocked',sourceAbilityId:aura.sourceId,sourceActorId:holder.actorId};
 }
 return null;
}

export function abilityStatusTypeImmunityBypass(source,status,target){
 const effect=abilityEffects(source).find(effect=>effect.kind==='status-type-immunity-bypass'&&(effect.statuses||[]).includes(status)&&targetTypeMatches(effect,target));
 return effect||null;
}

export function abilityCriticalRatioStages(unit){return abilityEffects(unit).filter(effect=>effect.kind==='critical-ratio').reduce((total,effect)=>total+(effect.stages||0),0);}
export function abilityPreventsCritical(unit){return abilityEffects(unit).some(effect=>effect.kind==='critical-immunity');}
export function abilityStabModifier(unit,move){return abilityEffects(unit).find(effect=>effect.kind==='stab-modifier'&&(unit.types||[]).includes(move?.type))?.multiplier??1.5;}
export function abilityPreventsRecoil(unit){return abilityEffects(unit).some(effect=>effect.kind==='recoil-immunity');}

export function abilityWeatherResidualDamageGroup(battle){
 const weather=effectiveWeatherId(battle),changes=[];if(!weather)return {id:'weather-ability-damage',changes};
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side))for(const effect of abilityEffects(unit)){
  if(effect.kind!=='weather-residual-damage'||effect.weather!==weather)continue;
  if(abilityPreventsIndirectDamage(unit))break;
  changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator))});break;
 }
 return {id:'weather-ability-damage',changes};
}

export function resolveEndTurnAbilityStatusCures(battle){
 let next=clone(battle);const events=[],weather=effectiveWeatherId(next);
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const current=unitById(next,unit.actorId),status=current?.status?.id||current?.status;if(!current||current.hp<=0||!status)continue;
  const weatherEffect=abilityEffects(current).find(effect=>effect.kind==='weather-status-cure'&&effect.weather===weather);
  if(weatherEffect){current.status=null;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:weatherEffect.sourceId,effectId:weatherEffect.kind},{kind:'statusCured',actorId:current.actorId,targetId:current.actorId,status,reason:'ability',abilityId:weatherEffect.sourceId});continue;}
  const randomEffect=abilityEffects(current).find(effect=>effect.kind==='random-status-cure');if(!randomEffect)continue;
  const roll=nextRandom(next.rngState);next.rngState=roll.rngState;if(roll.value>=randomEffect.chanceNumerator/randomEffect.chanceDenominator)continue;
  current.status=null;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:randomEffect.sourceId,effectId:randomEffect.kind},{kind:'statusCured',actorId:current.actorId,targetId:current.actorId,status,reason:'ability',abilityId:randomEffect.sourceId});
 }
 return {battle:next,events};
}


export function resolveEndTurnAbilityAllyStatusCures(battle){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const holder=unitById(next,unit.actorId);if(!holder||holder.hp<=0)continue;
  const effect=abilityEffects(holder).find(effect=>effect.kind==='end-turn-ally-status-cure');if(!effect)continue;
  for(const ally of activeAllies(next,holder)){
   const current=unitById(next,ally.actorId),status=current?.status?.id||current?.status;if(!current||current.hp<=0||!status)continue;
   const roll=nextRandom(next.rngState);next.rngState=roll.rngState;if(roll.value>=effect.chance)continue;
   current.status=null;events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:current.actorId},{kind:'statusCured',actorId:current.actorId,targetId:current.actorId,status,reason:'ally-ability',abilityId:effect.sourceId,sourceId:holder.actorId});
  }
 }
 return {battle:next,events};
}

export function resolveEndTurnAbilityBerryRestores(battle){
 let next=clone(battle);const events=[],weather=effectiveWeatherId(next);
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const current=unitById(next,unit.actorId);if(!current||current.hp<=0||current.itemState?.consumed!==true||current.itemState?.lostReason)continue;
  const itemId=current.itemState?.heldItemId;if(!itemId?.endsWith('-berry'))continue;
  const effect=abilityEffects(current).find(effect=>effect.kind==='end-turn-berry-restore');if(!effect)continue;
  let succeeds=effect.weatherGuarantee===weather;
  if(!succeeds){const roll=nextRandom(next.rngState);next.rngState=roll.rngState;succeeds=roll.value<effect.chance;}
  if(!succeeds)continue;
  current.itemState.consumed=false;current.itemState.lastActivationKey=null;events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId:effect.sourceId,effectId:effect.kind,itemId},{kind:'itemRestored',sourceId:current.actorId,itemId,reason:'ability',abilityId:effect.sourceId});
 }
 return {battle:next,events};
}
