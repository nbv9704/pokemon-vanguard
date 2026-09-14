import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const tagsOf=mechanics=>new Set(mechanics?.tags||[]);
const abilityEffects=unit=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='ability');
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
 const tags=tagsOf(mechanics);
 for(const effect of abilityEffects(target)){
  if(effect.kind==='move-tag-immunity'&&tags.has(effect.tag))return blocked(next,target,actorId,move,effect,false);
  if(effect.kind==='type-immunity-boost'&&move.type===effect.type){
   target.volatiles??={};const stateKey=effect.stateKey||effect.sourceId,activated=!target.volatiles[stateKey];
   target.volatiles[stateKey]={id:stateKey,sourceAbilityId:effect.sourceId};
   return blocked(next,target,actorId,move,effect,activated);
  }
 }
 return {battle:next,blocked:false,events:[]};
}

function blocked(battle,target,actorId,move,effect,activated){
 return {battle,blocked:true,events:[
  {kind:'abilityTriggered',sourceId:target.actorId,abilityId:effect.sourceId,effectId:effect.kind,...(activated?{activated:true}:{})},
  {kind:'moveBlocked',actorId,targetId:target.actorId,moveId:move.id,reason:'abilityImmune',abilityId:effect.sourceId}
 ]};
}

export function abilityPowerModifiers(unit,move,mechanics){
 const values=[],applied=[],tags=tagsOf(mechanics);
 for(const effect of abilityEffects(unit)){
  let active=false;
  if(effect.kind==='base-power-threshold-boost')active=Number.isFinite(move.power)&&move.power<=effect.maxPower;
  if(effect.kind==='move-tag-power-boost')active=tags.has(effect.tag);
  if(effect.kind==='secondary-effect-power-boost')active=Array.isArray(mechanics?.secondaryEffects)&&mechanics.secondaryEffects.length>0;
  if(!active)continue;values.push(effect.multiplier);applied.push({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier});
 }
 return {values,applied,apply(power){let next=power;for(const multiplier of values)next=Math.max(1,pokeRound(next*multiplier));return next;}};
}

export function abilityStatModifiers(unit,stat,battle,move=null){
 const weather=battle.field?.weather?.id,applied=abilityEffects(unit).filter(effect=>(effect.kind==='weather-stat-boost'&&effect.stat===stat&&effect.weather===weather)||(effect.kind==='type-immunity-boost'&&['atk','spa'].includes(stat)&&move?.type===effect.type&&Boolean(unit.volatiles?.[effect.stateKey||effect.sourceId])));
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(effect=>({sourceKind:'ability',sourceId:effect.sourceId,kind:effect.kind,multiplier:effect.multiplier})),apply(value){let next=value;for(const effect of applied)next=Math.max(1,Math.floor(next*effect.multiplier));return next;}};
}

export function abilityStatusBlock(battle,target,status){
 const weather=battle.field?.weather?.id;
 const effect=abilityEffects(target).find(effect=>effect.kind==='weather-status-immunity'&&effect.weather===weather&&(effect.statuses||[]).includes(status));
 return effect?{reason:'abilityBlocked',sourceAbilityId:effect.sourceId}:null;
}

export function abilityWeatherResidualDamageGroup(battle){
 const weather=battle.field?.weather?.id,changes=[];if(!weather)return {id:'weather-ability-damage',changes};
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side))for(const effect of abilityEffects(unit)){
  if(effect.kind!=='weather-residual-damage'||effect.weather!==weather)continue;
  changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator))});break;
 }
 return {id:'weather-ability-damage',changes};
}
