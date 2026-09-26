import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilityPreventsIndirectDamage} from './ability-hooks.mjs';
import {healingWithHeldItems} from './item-hooks.mjs';
import {applyStatStagesHandler} from './handlers/apply-stat-stages.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const sourceActive=(battle,actorId)=>{const side=sideOf(battle,actorId),unit=unitById(battle,actorId);return Boolean(side&&unit?.hp>0&&(battle.sides?.[side]?.active||[]).includes(actorId));};

export function preparePersistentEffectsEndTurn(battle){
 let next=clone(battle);const events=[],aqua=[],ingrain=[],salt=[],curse=[];
 for(const side of ['A','B'])for(const {unit:entry} of activeUnits(next,side,{includeFainted:true})){
  const unit=unitById(next,entry.actorId);if(!unit)continue;
  const trapped=unit.volatiles?.trapped;
  if(trapped?.sourceActorId&&!sourceActive(next,trapped.sourceActorId)){delete unit.volatiles.trapped;events.push({kind:'volatileEnded',actorId:unit.actorId,volatile:'trapped',reason:'sourceUnavailable',sourceActorId:trapped.sourceActorId,sourceMoveId:trapped.sourceId});}
  if(unit.hp<=0)continue;
  for(const [volatile,state] of Object.entries(unit.volatiles||{}))if(state?.recurringStatDrop){
   const sourceSide=sideOf(next,state.sourceActorId);if(!sourceActive(next,state.sourceActorId)){delete unit.volatiles[volatile];events.push({kind:'volatileEnded',actorId:unit.actorId,volatile,reason:'sourceUnavailable',sourceActorId:state.sourceActorId,sourceMoveId:state.sourceId});continue;}
   const source=unitById(next,state.sourceActorId),drop=state.recurringStatDrop,result=applyStatStagesHandler.run({battle:next,payload:{action:{actorId:source.actorId,side:sourceSide,target:null},move:{id:state.sourceId,category:'status'},mechanics:{targetMode:'adjacentFoe'},accuracyResolved:true,resolvedTargetIds:[unit.actorId],hitTargetIds:[unit.actorId]},params:{boosts:{[drop.stat]:drop.delta}}});next=result.battle;events.push(...result.events.map(event=>({...event,residualVolatile:volatile})));
  }
  if(unit.volatiles?.['aqua-ring']&&unit.hp<maxHp(unit)){const amount=healingWithHeldItems(Math.max(1,Math.floor(maxHp(unit)/16)),unit,next,{source:'aqua-ring'});aqua.push({actorId:unit.actorId,delta:amount});}
  if(unit.volatiles?.ingrain&&unit.hp<maxHp(unit)){const amount=healingWithHeldItems(Math.max(1,Math.floor(maxHp(unit)/16)),unit,next,{source:'ingrain'});ingrain.push({actorId:unit.actorId,delta:amount});}
  if(unit.volatiles?.curse&&!abilityPreventsIndirectDamage(unit))curse.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(maxHp(unit)/4))});
  if(unit.volatiles?.['salt-cure']&&!abilityPreventsIndirectDamage(unit)){
   const stronger=(unit.types||[]).some(type=>type==='water'||type==='steel'),denominator=stronger?8:16;
   salt.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(maxHp(unit)/denominator))});
  }
 }
 return {battle:next,events,groups:[{id:'aqua-ring-healing',changes:aqua},{id:'ingrain-healing',changes:ingrain},{id:'salt-cure-residual',changes:salt},{id:'curse-residual',changes:curse}]};
}
