import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {roomActive} from '../rooms.mjs';
import {abilityBerryConsumptionHeal,abilityBerryEffectMultiplier,abilitySuppressesHeldItems,opposingBerrySuppression} from '../ability-hooks.mjs';

export const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const battleStageIds=['atk','def','spa','spd','spe','accuracy','evasion'];
const inferredItemId=unit=>{const buildItem=unit?.buildSnapshot?.itemId;if(buildItem&&buildItem!=='none')return buildItem;return unit?.passiveEffects?.find(effect=>effect?.sourceKind==='item')?.sourceId||null;};
export const itemEffects=(unit,kind,battle)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='item'&&effect.kind===kind&&heldItemEffectActive(unit,effect,battle));

export function createHeldItemState(itemId){
 const heldItemId=itemId&&itemId!=='none'?itemId:null;
 return {heldItemId,consumed:false,revealed:false,activationCount:0,lastActivationKey:null,consumedBerryEver:false};
}

export function heldItemId(unit){
 const state=unit?.itemState;if(state?.consumed)return null;
 return state?.heldItemId??inferredItemId(unit);
}

export function heldItemEffectActive(unit,effect,battle){
 if(!unit||!effect||effect.sourceKind!=='item')return false;
 const current=heldItemId(unit);if(!current||current!==effect.sourceId)return false;
 if(abilitySuppressesHeldItems(unit))return false;
 return !roomActive(battle,'magic-room');
}

export function ensureItemState(unit){
 unit.itemState??=createHeldItemState(inferredItemId(unit));
 if(unit.itemState.heldItemId===undefined)unit.itemState.heldItemId=inferredItemId(unit);
 if(unit.itemState.consumed===undefined)unit.itemState.consumed=false;
 if(unit.itemState.revealed===undefined)unit.itemState.revealed=false;
 if(!Number.isInteger(unit.itemState.activationCount))unit.itemState.activationCount=0;
 if(unit.itemState.lastActivationKey===undefined)unit.itemState.lastActivationKey=null;
 if(unit.itemState.consumedBerryEver===undefined)unit.itemState.consumedBerryEver=false;
 return unit.itemState;
}

export const abilityItemEffect=(unit,kind)=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind===kind)||null;
export const itemEffectSnapshot=(unit,itemId)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='item'&&effect.sourceId===itemId).map(effect=>structuredClone(effect));
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

function recordConsumedItem(unit,itemId,battle,{reason,effects}){
 unit.itemHistory??=[];
 unit.itemHistory=unit.itemHistory.filter(entry=>Number.isInteger(entry?.turn)&&entry.turn>=battle.turn-1).slice(-7);
 const entry={itemId,turn:battle.turn,reason,effects:structuredClone(effects||[]),availableForPickup:reason!=='damaging-hit'};
 unit.itemHistory.push(entry);
 return entry;
}

function markItemLost(unit,itemId,reason){
 const state=ensureItemState(unit);state.heldItemId=itemId;state.consumed=true;state.lastActivationKey=null;state.lostReason=reason;state.revealed=true;
 unit.passiveEffects=(unit.passiveEffects||[]).filter(effect=>!(effect?.sourceKind==='item'&&effect.sourceId===itemId));
}

export function receiveTransferredItem(unit,itemId,effects,{revealed=true}={}){
 const consumedBerryEver=unit?.itemState?.consumedBerryEver===true;
 unit.passiveEffects=(unit.passiveEffects||[]).filter(effect=>effect?.sourceKind!=='item');
 unit.passiveEffects.push(...(effects||[]).map(effect=>structuredClone(effect)));
 unit.itemState=createHeldItemState(itemId);unit.itemState.revealed=revealed;unit.itemState.lostReason=null;unit.itemState.consumedBerryEver=consumedBerryEver;
}

export function removeHeldItem(battle,{actorId,reason='item-removed',sourceId=null,ignoreRemovalImmunity=false}={}){
 const next=clone(battle),events=[],unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,removed:false,events};
 const itemId=heldItemId(unit);if(!itemId)return {battle:next,removed:false,events};
 const blocker=!ignoreRemovalImmunity?abilityItemEffect(unit,'held-item-removal-immunity'):null;
 if(blocker){events.push({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:blocker.sourceId,effectId:blocker.kind,targetId:sourceId||unit.actorId,itemId},{kind:'itemRemovalBlocked',sourceId:sourceId||unit.actorId,targetId:unit.actorId,itemId,reason:'ability',abilityId:blocker.sourceId});return {battle:next,removed:false,blocked:true,itemId,events};}
 markItemLost(unit,itemId,reason);events.push({kind:'itemRemoved',sourceId:sourceId||unit.actorId,targetId:unit.actorId,itemId,reason});return {battle:next,removed:true,itemId,events};
}

export function swapHeldItems(battle,{sourceId,targetId,reason='item-swap',ignoreTargetRemovalImmunity=false}={}){
 let next=clone(battle);const events=[],source=unitById(next,sourceId),target=unitById(next,targetId);if(!source||!target||source.actorId===target.actorId)return {battle:next,swapped:false,events};
 const sourceItem=heldItemId(source),targetItem=heldItemId(target);if(!sourceItem&&!targetItem)return {battle:next,swapped:false,events};
 const blocker=targetItem&&!ignoreTargetRemovalImmunity?abilityItemEffect(target,'held-item-removal-immunity'):null;
 if(blocker){events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:blocker.sourceId,effectId:blocker.kind,targetId:source.actorId,itemId:targetItem},{kind:'itemSwapBlocked',sourceId:source.actorId,targetId:target.actorId,itemId:targetItem,reason:'ability',abilityId:blocker.sourceId});return {battle:next,swapped:false,blocked:true,events};}
 const sourceEffects=sourceItem?itemEffectSnapshot(source,sourceItem):[],targetEffects=targetItem?itemEffectSnapshot(target,targetItem):[];
 if(sourceItem)markItemLost(source,sourceItem,reason);else receiveTransferredItem(source,null,[],{revealed:false});
 if(targetItem)markItemLost(target,targetItem,reason);else receiveTransferredItem(target,null,[],{revealed:false});
 receiveTransferredItem(source,targetItem,targetEffects,{revealed:Boolean(targetItem)});receiveTransferredItem(target,sourceItem,sourceEffects,{revealed:Boolean(sourceItem)});
 if(sourceItem)events.push({kind:'itemTransferred',sourceId:source.actorId,targetId:target.actorId,itemId:sourceItem,reason});
 if(targetItem)events.push({kind:'itemTransferred',sourceId:target.actorId,targetId:source.actorId,itemId:targetItem,reason});
 events.push({kind:'itemsSwapped',sourceId:source.actorId,targetId:target.actorId,sourceItemId:sourceItem,targetItemId:targetItem,reason});
 return {battle:next,swapped:true,events};
}

export function transferHeldItem(battle,{fromId,toId,reason='item-transfer',sourceAbilityId=null,sourceAbilityHolderId=null,ignoreRemovalImmunity=false}={}){
 let next=clone(battle);const events=[],from=unitById(next,fromId),to=unitById(next,toId);if(!from||!to||from.actorId===to.actorId)return {battle:next,transferred:false,events};
 const itemId=heldItemId(from);if(!itemId||heldItemId(to))return {battle:next,transferred:false,events};
 const blocker=!ignoreRemovalImmunity?abilityItemEffect(from,'held-item-removal-immunity'):null;
 if(blocker){events.push({kind:'abilityTriggered',sourceId:from.actorId,abilityId:blocker.sourceId,effectId:blocker.kind,targetId:to.actorId,itemId},{kind:'itemTransferBlocked',sourceId:from.actorId,targetId:to.actorId,itemId,reason:'ability',abilityId:blocker.sourceId});return {battle:next,transferred:false,blocked:true,events};}
 const effects=itemEffectSnapshot(from,itemId);markItemLost(from,itemId,reason);receiveTransferredItem(to,itemId,effects,{revealed:true});
 if(sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:sourceAbilityHolderId||to.actorId,abilityId:sourceAbilityId,effectId:reason,itemId,fromId,targetId:to.actorId});
 events.push({kind:'itemTransferred',sourceId:from.actorId,targetId:to.actorId,itemId,reason,...(sourceAbilityId?{abilityId:sourceAbilityId}:{})});
 return {battle:next,transferred:true,itemId,events};
}

function scheduleBerryReplay(unit,itemId,battle,effects){
 const effect=abilityItemEffect(unit,'berry-replay');if(!effect||!itemId?.endsWith('-berry'))return null;
 unit.abilityState??={};const key=`berry-replay:${effect.sourceId}`;unit.abilityState[key]={itemId,dueTurn:battle.turn+1,effects:structuredClone(effects||[])};return {effect,key};
}

function resolveImmediateAllyItemPass(battle,{actorId,reason}){
 let next=clone(battle);const events=[];if(reason==='damaging-hit')return {battle:next,events};const side=sideOf(next,actorId);if(!side||heldItemId(unitById(next,actorId)))return {battle:next,events};
 for(const {unit} of activeUnits(next,side)){
  if(unit.actorId===actorId||unit.hp<=0)continue;const effect=abilityItemEffect(unit,'ally-item-pass');if(!effect||!heldItemId(unit))continue;
  const moved=transferHeldItem(next,{fromId:unit.actorId,toId:actorId,reason:'ally-item-pass',sourceAbilityId:effect.sourceId,sourceAbilityHolderId:unit.actorId});next=moved.battle;events.push(...moved.events);if(moved.transferred)break;
 }
 return {battle:next,events};
}

export function activateHeldItem(battle,{actorId,itemId,reason,consume=false,activationKey=null,allowFainted=false,ignoreBerrySuppression=false}){
 let next=clone(battle);let unit=unitById(next,actorId);if(!unit||(!allowFainted&&unit.hp<=0))return {battle:next,applied:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};
 if(!heldItemEffectActive(unit,effect,next))return {battle:next,applied:false,events:[]};
 if(consume&&itemId?.endsWith('-berry')&&!ignoreBerrySuppression){
  const suppression=opposingBerrySuppression(next,unit);if(suppression)return {battle:next,applied:false,events:[{kind:'abilityTriggered',sourceId:suppression.holder.actorId,abilityId:suppression.effect.sourceId,effectId:suppression.effect.kind,targetId:actorId},{kind:'itemActivationBlocked',sourceId:actorId,itemId,reason:'opponentAbility',abilityId:suppression.effect.sourceId}]};
 }
 if(activationKey&&state.lastActivationKey===activationKey)return {battle:next,applied:false,idempotent:true,events:[]};
 const events=[],consumedEffects=consume?itemEffectSnapshot(unit,itemId):[];if(!state.revealed){state.revealed=true;events.push({kind:'itemRevealed',sourceId:actorId,itemId,reason});}
 state.activationCount++;state.lastActivationKey=activationKey||null;events.push({kind:'itemActivated',sourceId:actorId,itemId,reason,activationCount:state.activationCount});
 if(consume){state.consumed=true;recordConsumedItem(unit,itemId,next,{reason,effects:consumedEffects});scheduleBerryReplay(unit,itemId,next,consumedEffects);events.push({kind:'itemConsumed',sourceId:actorId,itemId,reason});
  if(itemId?.endsWith('-berry')){state.consumedBerryEver=true;const effect=abilityBerryConsumptionHeal(unit);if(effect&&unit.hp>0&&unit.hp<maxHp(unit)){const before=unit.hp,amount=Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator));unit.hp=Math.min(maxHp(unit),unit.hp+amount);events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,itemId},{kind:'heal',targetId:actorId,hpBefore:before,hpAfter:unit.hp,amount:unit.hp-before,source:`ability:${effect.sourceId}`,abilityId:effect.sourceId,trigger:'berry-consumed'});}}
  const passed=resolveImmediateAllyItemPass(next,{actorId,reason});next=passed.battle;events.push(...passed.events);unit=unitById(next,actorId);
 }
 return {battle:next,applied:true,events};
}


export function hasConsumedBerry(unit){
 return unit?.itemState?.consumedBerryEver===true;
}

function applyConsumedBerryEffects(battle,{actorId,itemId,effects,reason}){
 let next=clone(battle);const events=[];const unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,events};
 for(const effect of effects||[]){
  if(effect.kind==='item-threshold-heal'&&unit.hp<maxHp(unit)){
   const numerator=effect.healNumerator??1,denominator=effect.healDenominator??4,baseAmount=Number.isInteger(effect.healAmount)?effect.healAmount:Math.max(1,Math.floor(maxHp(unit)*numerator/denominator)),multiplier=abilityBerryEffectMultiplier(unit),amount=Math.max(1,Math.floor(baseAmount*multiplier)),before=unit.hp;unit.hp=Math.min(maxHp(unit),unit.hp+amount);if(unit.hp>before)events.push({kind:'heal',targetId:unit.actorId,hpBefore:before,hpAfter:unit.hp,amount:unit.hp-before,source:itemId,itemId,reason,...(multiplier>1?{abilityMultiplier:multiplier}:{})});
  }else if(effect.kind==='item-status-cure'){
   const currentStatus=statusId(unit),statusMatch=!!currentStatus&&Array.isArray(effect.statuses)&&effect.statuses.includes(currentStatus),confusionMatch=!!unit.volatiles?.confusion&&effect.confusion===true;
   if(statusMatch&&unit.status){unit.status=null;events.push({kind:'statusCured',actorId:unit.actorId,targetId:unit.actorId,status:currentStatus,reason,itemId});}
   if(confusionMatch&&unit.volatiles?.confusion){delete unit.volatiles.confusion;events.push({kind:'volatileEnded',actorId:unit.actorId,targetId:unit.actorId,volatile:'confusion',reason,itemId});}
  }else if(effect.kind==='item-pp-restore'){
   const moveIds=unit.buildSnapshot?.moveIds||Object.keys(unit.pp||{}),moveId=moveIds.find(id=>Number.isInteger(unit.pp?.[id])&&Number.isInteger(unit.maxPp?.[id])&&unit.pp[id]<unit.maxPp[id]);if(moveId){const before=unit.pp[moveId],multiplier=abilityBerryEffectMultiplier(unit),after=Math.min(unit.maxPp[moveId],before+(effect.amount??10)*multiplier);unit.pp[moveId]=after;events.push({kind:'ppRestored',actorId:unit.actorId,moveId,itemId,ppBefore:before,ppAfter:after,amount:after-before,reason,...(multiplier>1?{abilityMultiplier:multiplier}:{})});}
  }
 }
 return {battle:next,events};
}

export function consumeHeldItemForFling(battle,{actorId,itemId}={}){
 let next=clone(battle),events=[],unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,consumed:false,events};
 const current=heldItemId(unit);if(!current||current!==itemId)return {battle:next,consumed:false,events};
 const effects=itemEffectSnapshot(unit,itemId),state=ensureItemState(unit),wasRevealed=state.revealed===true;recordConsumedItem(unit,itemId,next,{reason:'fling',effects});markItemLost(unit,itemId,'fling');
 if(!wasRevealed)events.push({kind:'itemRevealed',sourceId:actorId,itemId,reason:'fling'});events.push({kind:'itemConsumed',sourceId:actorId,itemId,reason:'fling'});
 const passed=resolveImmediateAllyItemPass(next,{actorId,reason:'fling'});next=passed.battle;events.push(...passed.events);
 return {battle:next,consumed:true,itemId,effects,events};
}

export function applyThrownBerryEffects(battle,{sourceId,targetId,itemId,effects=[]}={}){
 let next=clone(battle),events=[],target=unitById(next,targetId);if(!target||target.hp<=0)return {battle:next,applied:false,events};
 const suppression=opposingBerrySuppression(next,target);if(suppression)return {battle:next,applied:false,events:[{kind:'abilityTriggered',sourceId:suppression.holder.actorId,abilityId:suppression.effect.sourceId,effectId:suppression.effect.kind,targetId},{kind:'itemActivationBlocked',sourceId:targetId,itemId,reason:'opponentAbility',abilityId:suppression.effect.sourceId,fromFling:true}]};
 const state=ensureItemState(target);state.consumedBerryEver=true;scheduleBerryReplay(target,itemId,next,effects);events.push({kind:'flingBerryActivated',sourceId,targetId,itemId});
 const cheek=abilityBerryConsumptionHeal(target);if(cheek&&target.hp>0&&target.hp<maxHp(target)){const before=target.hp,amount=Math.max(1,Math.floor(maxHp(target)*cheek.numerator/cheek.denominator));target.hp=Math.min(maxHp(target),target.hp+amount);events.push({kind:'abilityTriggered',sourceId:targetId,abilityId:cheek.sourceId,effectId:cheek.kind,itemId},{kind:'heal',targetId,hpBefore:before,hpAfter:target.hp,amount:target.hp-before,source:`ability:${cheek.sourceId}`,abilityId:cheek.sourceId,trigger:'berry-consumed'});}
 const applied=applyConsumedBerryEffects(next,{actorId:targetId,itemId,effects,reason:'fling'});next=applied.battle;events.push(...applied.events);return {battle:next,applied:true,events};
}

export function consumeHeldBerry(battle,{holderId,consumerId=holderId,reason='forced-berry-consumption',ignoreBerrySuppression=false}={}){
 let next=clone(battle);const events=[],holder=unitById(next,holderId),consumer=unitById(next,consumerId);if(!holder||!consumer||consumer.hp<=0)return {battle:next,consumed:false,events};const itemId=heldItemId(holder);if(!itemId?.endsWith('-berry'))return {battle:next,consumed:false,events};
 const effects=itemEffectSnapshot(holder,itemId);
 if(holderId===consumerId){const activated=activateHeldItem(next,{actorId:holderId,itemId,reason,consume:true,activationKey:`forced-berry:${next.turn}:${holderId}:${reason}`,ignoreBerrySuppression});next=activated.battle;events.push(...activated.events);if(!activated.applied)return {battle:next,consumed:false,itemId,events};const applied=applyConsumedBerryEffects(next,{actorId:consumerId,itemId,effects,reason});next=applied.battle;events.push(...applied.events);return {battle:next,consumed:true,itemId,events};}
 const blocker=abilityItemEffect(holder,'held-item-removal-immunity');if(blocker){events.push({kind:'abilityTriggered',sourceId:holder.actorId,abilityId:blocker.sourceId,effectId:blocker.kind,targetId:consumer.actorId,itemId},{kind:'itemRemovalBlocked',sourceId:consumer.actorId,targetId:holder.actorId,itemId,reason:'ability',abilityId:blocker.sourceId});return {battle:next,consumed:false,itemId,events};}
 if(!ignoreBerrySuppression){const suppression=opposingBerrySuppression(next,consumer);if(suppression)return {battle:next,consumed:false,itemId,events:[{kind:'abilityTriggered',sourceId:suppression.holder.actorId,abilityId:suppression.effect.sourceId,effectId:suppression.effect.kind,targetId:consumerId},{kind:'itemActivationBlocked',sourceId:consumerId,itemId,reason:'opponentAbility',abilityId:suppression.effect.sourceId}]};}
 const liveHolder=unitById(next,holderId);recordConsumedItem(liveHolder,itemId,next,{reason,effects});markItemLost(liveHolder,itemId,reason);const liveConsumer=unitById(next,consumerId),consumerState=ensureItemState(liveConsumer);consumerState.consumedBerryEver=true;scheduleBerryReplay(liveConsumer,itemId,next,effects);events.push({kind:'itemRevealed',sourceId:holderId,itemId,reason},{kind:'itemConsumed',sourceId:consumerId,fromId:holderId,itemId,reason});
 const cheek=abilityBerryConsumptionHeal(liveConsumer);if(cheek&&liveConsumer.hp>0&&liveConsumer.hp<maxHp(liveConsumer)){const before=liveConsumer.hp,amount=Math.max(1,Math.floor(maxHp(liveConsumer)*cheek.numerator/cheek.denominator));liveConsumer.hp=Math.min(maxHp(liveConsumer),liveConsumer.hp+amount);events.push({kind:'abilityTriggered',sourceId:consumerId,abilityId:cheek.sourceId,effectId:cheek.kind,itemId},{kind:'heal',targetId:consumerId,hpBefore:before,hpAfter:liveConsumer.hp,amount:liveConsumer.hp-before,source:`ability:${cheek.sourceId}`,abilityId:cheek.sourceId,trigger:'berry-consumed'});}
 const applied=applyConsumedBerryEffects(next,{actorId:consumerId,itemId,effects,reason});next=applied.battle;events.push(...applied.events);const passed=resolveImmediateAllyItemPass(next,{actorId:holderId,reason});next=passed.battle;events.push(...passed.events);return {battle:next,consumed:true,itemId,events};
}

export function recycleConsumedItem(battle,{actorId,reason='recycle'}={}){
 const next=clone(battle),unit=unitById(next,actorId),events=[];if(!unit||unit.hp<=0||heldItemId(unit))return {battle:next,recycled:false,events};const history=[...(unit.itemHistory||[])].reverse().find(entry=>entry?.itemId&&!entry.recycled);if(!history)return {battle:next,recycled:false,events};history.recycled=true;history.availableForPickup=false;receiveTransferredItem(unit,history.itemId,history.effects,{revealed:true});events.push({kind:'itemRecycled',actorId,itemId:history.itemId,reason});return {battle:next,recycled:true,itemId:history.itemId,events};
}


export function revealHeldItem(battle,{actorId,itemId,reason,force=false}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,revealed:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};if((force?heldItemId(unit)!==itemId:!heldItemEffectActive(unit,effect,next))||state.revealed)return {battle:next,revealed:false,events:[]};
 state.revealed=true;return {battle:next,revealed:true,events:[{kind:'itemRevealed',sourceId:actorId,itemId,reason}]};
}

export function heldItemHasEffect(unit,kind,battle){return itemEffects(unit,kind,battle).length>0;}

export const statusId=unit=>unit?.status?.id||unit?.status||null;
