import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const tagsOf=mechanics=>new Set(mechanics?.tags||[]);
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const activeSideUnits=(battle,side)=>side?activeUnits(battle,side).map(entry=>entry.unit):[];
const activeAllies=(battle,unit)=>activeSideUnits(battle,sideOf(battle,unit?.actorId)).filter(ally=>ally.actorId!==unit.actorId);
const targetTypeMatches=(effect,target)=>!(effect.targetTypes||[]).length||(target?.types||[]).some(type=>effect.targetTypes.includes(type));
const pokeRound=value=>value%1>.5?Math.ceil(value):Math.floor(value);

export function modifyMoveByAbility(unit,move,mechanics){
 const nextMove=structuredClone(move),nextMechanics=structuredClone(mechanics),applied=[],tags=tagsOf(nextMechanics);
 for(const effect of abilityEffects(unit)){
  if(effect.kind==='move-type-by-tag'&&tags.has(effect.tag)&&nextMove.type!==effect.type){
   const fromType=nextMove.type;nextMove.type=effect.type;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,fromType,toType:effect.type});
  }
  if(effect.kind==='secondary-effect-power-boost'&&Array.isArray(nextMechanics.secondaryEffects)&&nextMechanics.secondaryEffects.length){
   nextMechanics.secondaryEffectsSuppressed=true;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier,suppressedSecondaries:nextMechanics.secondaryEffects.length});
  }
  if(effect.kind==='remove-contact'&&nextMechanics.contact){
   nextMechanics.contact=false;applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind});
  }
 }
 return {move:nextMove,mechanics:nextMechanics,applied};
}

export function resolveTargetAbilityBlock(battle,{actorId,targetId,move,mechanics}){
 const next=clone(battle),target=unitById(next,targetId);if(!target||target.hp<=0||target.actorId===actorId)return {battle:next,blocked:false,events:[]};
 const tags=tagsOf(mechanics),actorSide=sideOf(next,actorId),targetSide=sideOf(next,targetId);
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
  target.stages??={};const stat=effect.stat,before=Number.isInteger(target.stages[stat])?target.stages[stat]:0,after=Math.max(-6,Math.min(6,before+effect.stages)),appliedDelta=after-before;target.stages[stat]=after;
  events.push({kind:'statStageChanged',actorId:target.actorId,targetId:target.actorId,abilityId:effect.sourceId,stat,before,after,requestedDelta:effect.stages,appliedDelta,reason:appliedDelta===0?'stageLimit':null,trigger:'type-immunity'});
 }
 events.push({kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'abilityImmune',abilityId:effect.sourceId});
 return {battle,blocked:true,events};
}

export function abilityPowerModifiers(unit,move,mechanics){
 const values=[],applied=[],tags=tagsOf(mechanics),hasRecoil=Array.isArray(mechanics?.handlers)&&mechanics.handlers.some(handler=>handler?.id==='apply-recoil');
 for(const effect of abilityEffects(unit)){
  let active=false;
  if(effect.kind==='base-power-threshold-boost')active=Number.isFinite(move.power)&&move.power<=effect.maxPower;
  if(effect.kind==='move-tag-power-boost')active=tags.has(effect.tag);
  if(effect.kind==='secondary-effect-power-boost')active=Array.isArray(mechanics?.secondaryEffects)&&mechanics.secondaryEffects.length>0;
  if(effect.kind==='contact-power-boost')active=mechanics?.contact===true;
  if(effect.kind==='recoil-power-boost')active=hasRecoil;
  if(!active)continue;values.push(effect.multiplier);applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier});
 }
 return {values,applied,apply(power){let next=power;for(const multiplier of values)next=Math.max(1,pokeRound(next*multiplier));return next;}};
}

export function abilityStatModifiers(unit,stat,battle,move=null){
 const weather=battle.field?.weather?.id,terrain=battle.field?.terrain?.id,allies=activeAllies(battle,unit),applied=abilityEffects(unit).filter(effect=>(effect.kind==='weather-stat-boost'&&effect.stat===stat&&effect.weather===weather)||(effect.kind==='type-immunity-boost'&&['atk','spa'].includes(stat)&&move?.type===effect.type&&Boolean(unit.volatiles?.[effect.stateKey||effect.sourceId]))||(effect.kind==='stat-multiplier'&&effect.stat===stat&&(!effect.requireStatus||Boolean(unit.status))&&(!effect.terrain||effect.terrain===terrain))||(effect.kind==='ally-ability-stat-multiplier'&&effect.stat===stat&&allies.some(ally=>abilityEffects(ally).some(allyEffect=>(effect.allyAbilities||[]).includes(allyEffect.sourceId)))));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(effect=>({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier})),apply(value){let next=value;for(const effect of applied)next=Math.max(1,Math.floor(next*effect.multiplier));return next;}};
}

export function abilityOutgoingAccuracyModifier(unit,move=null){
 const effects=abilityEffects(unit).filter(effect=>effect.kind==='outgoing-accuracy-modifier'&&(!effect.category||effect.category===move?.category));return effects.reduce((value,effect)=>value*effect.multiplier,1);
}

export function abilityForcesHit(unit){return abilityEffects(unit).some(effect=>effect.kind==='always-hit');}
export function abilityIgnoresBurnAttackPenalty(unit){return abilityEffects(unit).some(effect=>effect.kind==='burn-attack-penalty-immunity');}
export function abilityIgnoresParalysisSpeedPenalty(unit){return abilityEffects(unit).some(effect=>effect.kind==='paralysis-speed-penalty-immunity');}
export function abilityMaximizesMultiHit(unit){return abilityEffects(unit).some(effect=>effect.kind==='multi-hit-max');}
export function abilityBlocksSecondaryEffects(unit){return abilityEffects(unit).some(effect=>effect.kind==='secondary-effect-immunity');}

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

export function abilityVolatileBlock(target,volatile){
 const effect=abilityEffects(target).find(effect=>effect.kind==='volatile-immunity'&&(effect.volatiles||[]).includes(volatile));
 return effect?{reason:'abilityBlocked',sourceAbilityId:effect.sourceId}:null;
}

export function abilityForcesCritical(unit,target){
 const status=target?.status?.id||target?.status;
 return Boolean(status)&&abilityEffects(unit).some(effect=>effect.kind==='critical-vs-status'&&(effect.statuses||[]).includes(status));
}

export function abilityStatusResidualHeal(unit,status){return abilityEffects(unit).find(effect=>effect.kind==='status-residual-heal'&&(effect.statuses||[]).includes(status))||null;}
export function abilityStatusReflect(unit,status){return abilityEffects(unit).find(effect=>effect.kind==='status-reflect'&&(effect.statuses||[]).includes(status))||null;}

export function allyReceivedDamageModifiers(battle,target,actor){
 const targetSide=sideOf(battle,target?.actorId),actorSide=sideOf(battle,actor?.actorId);if(!targetSide||targetSide===actorSide)return {values:[],applied:[]};
 const applied=activeAllies(battle,target).flatMap(ally=>abilityEffects(ally).filter(effect=>effect.kind==='ally-damage-reduction').map(effect=>({...effect,holderId:ally.actorId})));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(effect=>({sourceKind:'ability',sourceId:effect.sourceId,holderId:effect.holderId,kind:effect.kind,multiplier:effect.multiplier}))};
}

export function abilityIncomingAccuracyModifier(target,battle){
 const weather=battle.field?.weather?.id,volatileIds=new Set(Object.keys(target?.volatiles||{}));
 const effects=abilityEffects(target).filter(effect=>(effect.kind==='weather-incoming-accuracy-modifier'&&effect.weather===weather)||(effect.kind==='volatile-incoming-accuracy-modifier'&&volatileIds.has(effect.volatile)));
 return effects.reduce((value,effect)=>value*effect.multiplier,1);
}

export function abilityStatusBlock(battle,target,status,{sourceId=null}={}){
 const weather=battle.field?.weather?.id;
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
 const weather=battle.field?.weather?.id,changes=[];if(!weather)return {id:'weather-ability-damage',changes};
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side))for(const effect of abilityEffects(unit)){
  if(effect.kind!=='weather-residual-damage'||effect.weather!==weather)continue;
  changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator))});break;
 }
 return {id:'weather-ability-damage',changes};
}

export function resolveEndTurnAbilityStatusCures(battle){
 let next=clone(battle);const events=[],weather=next.field?.weather?.id;
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
