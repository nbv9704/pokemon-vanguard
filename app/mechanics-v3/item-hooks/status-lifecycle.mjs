import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {nextRandom} from '../../rules-v3/rng.mjs';
import {abilityBerryEffectMultiplier} from '../ability-hooks.mjs';
import {abilityItemEffect,activateHeldItem,heldItemId,itemEffects,maxHp,receiveTransferredItem,statusId} from './state.mjs';

const battleStageIds=['atk','def','spa','spd','spe','accuracy','evasion'];

export function resolveNegativeStageResetItems(battle,{actorIds=null,trigger='stat-update'}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){
  const target=unitById(next,actorId);if(!target||target.hp<=0)continue;
  const effect=itemEffects(target,'item-negative-stage-reset',next)[0];if(!effect)continue;
  const lowered=battleStageIds.filter(stat=>(Number.isInteger(target.stages?.[stat])?target.stages[stat]:0)<0);if(!lowered.length)continue;
  const signature=lowered.map(stat=>`${stat}:${target.stages[stat]}`).join(',');
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'negative-stage-reset',consume:true,activationKey:`negative-stage-reset:${next.turn}:${actorId}:${effect.sourceId}:${signature}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId);if(!current)continue;current.stages??={};
  for(const stat of battleStageIds){const before=Number.isInteger(current.stages[stat])?current.stages[stat]:0;if(before>=0)continue;current.stages[stat]=0;events.push({kind:'statStageChanged',actorId,targetId:actorId,stat,before,after:0,requestedDelta:-before,appliedDelta:-before,reason:'held-item',itemId:effect.sourceId});}
 }
 return {battle:next,events};
}

export function resolveStatusCureItems(battle,{actorIds=null,trigger='status-update'}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){
  const target=unitById(next,actorId);if(!target||target.hp<=0)continue;
  const effect=itemEffects(target,'item-status-cure',next)[0];if(!effect)continue;
  const currentStatus=statusId(target),hasConfusion=!!target.volatiles?.confusion,statusMatch=!!currentStatus&&Array.isArray(effect.statuses)&&effect.statuses.includes(currentStatus),confusionMatch=hasConfusion&&effect.confusion===true;
  if(!statusMatch&&!confusionMatch)continue;
  const key=`status-cure:${next.turn}:${actorId}:${effect.sourceId}:${currentStatus||'none'}:${hasConfusion?'confused':'clear'}:${trigger}`;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'status-cure',consume:true,activationKey:key});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId);
  if(statusMatch&&current?.status){const cured=statusId(current);current.status=null;events.push({kind:'statusCured',actorId,targetId:actorId,status:cured,reason:'held-item',itemId:effect.sourceId});}
  if(confusionMatch&&current?.volatiles?.confusion){delete current.volatiles.confusion;events.push({kind:'volatileEnded',actorId,targetId:actorId,volatile:'confusion',reason:'held-item',itemId:effect.sourceId});}
 }
 return {battle:next,events};
}

export function resolveVolatileCureItems(battle,{actorIds=null,trigger='volatile-update'}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){
  const target=unitById(next,actorId);if(!target||target.hp<=0)continue;const effect=itemEffects(target,'item-volatile-cure',next)[0];if(!effect)continue;
  const matches=(effect.volatiles||[]).filter(id=>target.volatiles?.[id]);if(!matches.length)continue;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'volatile-cure',consume:true,activationKey:`volatile-cure:${next.turn}:${actorId}:${effect.sourceId}:${matches.sort().join(',')}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId);for(const volatile of matches)if(current?.volatiles?.[volatile]){delete current.volatiles[volatile];events.push({kind:'volatileEnded',actorId,targetId:actorId,volatile,reason:'held-item',itemId:effect.sourceId});}
 }
 return {battle:next,events};
}

function applyReplayedBerryEffect(battle,unit,effect,itemId){
 let next=battle;const events=[];
 if(effect.kind==='item-threshold-heal'&&unit.hp>0&&unit.hp<maxHp(unit)){
  const numerator=effect.healNumerator??1,denominator=effect.healDenominator??4,baseAmount=Number.isInteger(effect.healAmount)?effect.healAmount:Math.max(1,Math.floor(maxHp(unit)*numerator/denominator)),multiplier=abilityBerryEffectMultiplier(unit),amount=Math.max(1,Math.floor(baseAmount*multiplier)),healed=applyHpGroup(next,[{actorId:unit.actorId,delta:amount}],itemId);next=healed.battle;events.push(...healed.events.map(event=>({...event,itemId,reason:'berry-replay',...(multiplier>1?{abilityMultiplier:multiplier}:{})})));
 }else if(effect.kind==='item-status-cure'){
  const current=unitById(next,unit.actorId),currentStatus=statusId(current),statusMatch=!!currentStatus&&Array.isArray(effect.statuses)&&effect.statuses.includes(currentStatus),confusionMatch=!!current?.volatiles?.confusion&&effect.confusion===true;
  if(statusMatch&&current?.status){current.status=null;events.push({kind:'statusCured',actorId:current.actorId,targetId:current.actorId,status:currentStatus,reason:'berry-replay',itemId});}
  if(confusionMatch&&current?.volatiles?.confusion){delete current.volatiles.confusion;events.push({kind:'volatileEnded',actorId:current.actorId,targetId:current.actorId,volatile:'confusion',reason:'berry-replay',itemId});}
 }else if(effect.kind==='item-pp-restore'){
  const current=unitById(next,unit.actorId),moveIds=current?.buildSnapshot?.moveIds||Object.keys(current?.pp||{}),moveId=moveIds.find(id=>Number.isInteger(current?.pp?.[id])&&Number.isInteger(current?.maxPp?.[id])&&current.pp[id]<current.maxPp[id]);
  if(moveId){const before=current.pp[moveId],multiplier=abilityBerryEffectMultiplier(current),after=Math.min(current.maxPp[moveId],before+(effect.amount??10)*multiplier);current.pp[moveId]=after;events.push({kind:'ppRestored',actorId:current.actorId,moveId,itemId,ppBefore:before,ppAfter:after,amount:after-before,reason:'berry-replay',...(multiplier>1?{abilityMultiplier:multiplier}:{})});}
 }
 return {battle:next,events};
}

export function resolveEndTurnItemAbilityLifecycle(battle){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const current=unitById(next,unit.actorId);if(!current||current.hp<=0)continue;
  for(const [key,state] of Object.entries(current.abilityState||{})){
   if(!key.startsWith('berry-replay:')||!state||state.dueTurn!==next.turn)continue;const abilityId=key.slice('berry-replay:'.length),effect=abilityItemEffect(current,'berry-replay');delete current.abilityState[key];if(!effect||effect.sourceId!==abilityId)continue;
   events.push({kind:'abilityTriggered',sourceId:current.actorId,abilityId,effectId:'berry-replay',itemId:state.itemId},{kind:'itemActivated',sourceId:current.actorId,itemId:state.itemId,reason:'berry-replay',activationCount:(current.itemState?.activationCount||0)+1});
   for(const itemEffect of state.effects||[]){const applied=applyReplayedBerryEffect(next,unitById(next,current.actorId),itemEffect,state.itemId);next=applied.battle;events.push(...applied.events);}
  }
 }
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  let holder=unitById(next,unit.actorId);if(!holder||holder.hp<=0||heldItemId(holder))continue;const effect=abilityItemEffect(holder,'end-turn-item-pickup');if(!effect)continue;
  const candidates=[];for(const otherSide of ['A','B'])for(const {unit:other} of activeUnits(next,otherSide)){if(other.actorId===holder.actorId)continue;for(const history of other.itemHistory||[])if(history?.turn===next.turn&&history.availableForPickup===true)candidates.push({ownerId:other.actorId,history});}
  if(!candidates.length)continue;candidates.sort((a,b)=>a.ownerId.localeCompare(b.ownerId)||a.history.itemId.localeCompare(b.history.itemId));let chosen=candidates[0];if(candidates.length>1){const roll=nextRandom(next.rngState);next.rngState=roll.rngState;chosen=candidates[Math.min(candidates.length-1,Math.floor(roll.value*candidates.length))];}
  chosen.history.availableForPickup=false;holder=unitById(next,holder.actorId);receiveTransferredItem(holder,chosen.history.itemId,chosen.history.effects,{revealed:true});events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:effect.sourceId,effectId:effect.kind,itemId:chosen.history.itemId,fromId:chosen.ownerId},{kind:'itemTransferred',sourceId:chosen.ownerId,targetId:holder.actorId,itemId:chosen.history.itemId,reason:'end-turn-item-pickup',abilityId:effect.sourceId});
 }
 return {battle:next,events};
}

export function resolveEndTurnItems(battle){
 let next=clone(battle);const events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const current=unitById(next,unit.actorId);if(!current||current.hp<=0||current.hp>=maxHp(current))continue;
  const effect=itemEffects(current,'item-end-turn-heal',next)[0];if(!effect)continue;
  const activated=activateHeldItem(next,{actorId:current.actorId,itemId:effect.sourceId,reason:'end-turn-recovery',activationKey:`end-turn:${next.turn}:${current.actorId}:${effect.sourceId}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const holder=unitById(next,current.actorId),numerator=effect.numerator??1,denominator=effect.denominator??16,amount=Math.max(1,Math.floor(maxHp(holder)*numerator/denominator)),healed=applyHpGroup(next,[{actorId:holder.actorId,delta:amount}],effect.sourceId);next=healed.battle;events.push(...healed.events);
 }
 return {battle:next,events};
}
