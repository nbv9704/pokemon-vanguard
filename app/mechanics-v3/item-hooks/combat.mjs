import {activeUnits,clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup,requestForcedReplacement} from '../../rules-v3/lifecycle.mjs';
import {applyForcedSwitches} from '../switching.mjs';
import {abilityStageChange} from '../ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities} from '../ability-stage-response.mjs';
import {abilityBerryEffectMultiplier,abilityBlocksSecondaryEffects,abilityPreventsIndirectDamage,abilityVolatileBlock} from '../ability-hooks.mjs';
import {abilityItemEffect,activateHeldItem,heldItemEffectActive,itemEffects,maxHp,revealHeldItem} from './state.mjs';
import {typeEffectivenessWithHeldItems} from './modifiers.mjs';

export function applyResistanceBerryToMoveDamage(battle,{targetId,moveType,effectiveness,moveId,hit=null}={}){
 const target=unitById(battle,targetId);if(!target||target.hp<=0||!moveType||!Number.isFinite(effectiveness)||effectiveness<=0)return {battle:clone(battle),multiplier:1,events:[]};
 const effect=itemEffects(target,'item-resist-hit',battle).find(effect=>effect.type===moveType&&(effect.requireSuperEffective===false||effectiveness>1));if(!effect)return {battle:clone(battle),multiplier:1,events:[]};
 const activated=activateHeldItem(battle,{actorId:targetId,itemId:effect.sourceId,reason:'resist-hit',consume:true,activationKey:`resist-hit:${battle.turn}:${targetId}:${moveId}:${hit??'single'}:${moveType}:${effectiveness}`});
 const berryMultiplier=abilityBerryEffectMultiplier(unitById(activated.battle,targetId)),base=effect.multiplier??0.5,adjusted=berryMultiplier>1?Math.pow(base,berryMultiplier):base;
 return activated.applied?{battle:activated.battle,multiplier:adjusted,events:activated.events,itemId:effect.sourceId}:{battle:activated.battle,multiplier:1,events:activated.events};
}

export function applySurvivalItemToMoveDamage(battle,{targetId,damage,moveId,hit=null,runtime=null}){
 const target=unitById(battle,targetId);if(!target||target.hp<=0||!Number.isInteger(damage)||damage<target.hp)return {battle:clone(battle),damage,events:[]};
 const effect=itemEffects(target,'item-survive-lethal-hit',battle)[0];if(!effect)return {battle:clone(battle),damage,events:[]};
 if(effect.requireFullHp!==false&&target.hp!==maxHp(target))return {battle:clone(battle),damage,events:[]};
 if(Number.isFinite(effect.chance)){if(typeof runtime?.nextRandom!=='function')throw new Error('probabilistic survival item requires seeded nextRandom');if(runtime.nextRandom()>=effect.chance)return {battle:clone(battle),damage,events:[]};}
 const count=target.itemState?.activationCount??0,activated=activateHeldItem(battle,{actorId:targetId,itemId:effect.sourceId,reason:'survive-lethal-hit',consume:effect.consume!==false,activationKey:`damage:${battle.turn}:${targetId}:${moveId}:${hit??'single'}:${target.hp}:${count}`});
 return activated.applied?{battle:activated.battle,damage:Math.max(0,target.hp-1),events:activated.events,itemId:effect.sourceId}:{battle:activated.battle,damage,events:activated.events};
}

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

export function resolvePostDamageItems(battle,{targetId,moveId,damage=0}={}){
 let next=clone(battle);const events=[],target=unitById(next,targetId);if(!target)return {battle:next,events};
 if(damage>0){const effect=itemEffects(target,'item-airborne',next).find(effect=>effect.popOnDamage!==false);if(effect){const popped=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'damaging-hit',consume:true,activationKey:`airborne-pop:${next.turn}:${targetId}:${moveId}`,allowFainted:true});next=popped.battle;events.push(...popped.events);}}
 const threshold=resolveHpThresholdItems(next,{actorIds:[targetId],trigger:`move:${moveId}`});next=threshold.battle;events.push(...threshold.events);return {battle:next,events};
}

export function resolveContactDamageItems(battle,{attackerId,targetId,moveId,mechanics,damage,hit=null}={}){
 let next=clone(battle);const events=[];
 if(!Number.isInteger(damage)||damage<=0||mechanics?.contact!==true)return {battle:next,events};
 const holder=unitById(next,targetId),attacker=unitById(next,attackerId);if(!holder||!attacker||attacker.hp<=0)return {battle:next,events};
 const effect=itemEffects(holder,'item-contact-retaliation',next)[0];if(!effect)return {battle:next,events};
 const activationKey=`contact:${next.turn}:${targetId}:${attackerId}:${moveId}:${hit??'single'}:${holder.hp}:${attacker.hp}`;
 const activated=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'contact-retaliation',activationKey,allowFainted:true});next=activated.battle;events.push(...activated.events);if(!activated.applied)return {battle:next,events};
 const source=unitById(next,targetId),liveAttacker=unitById(next,attackerId);if(!source||!liveAttacker||liveAttacker.hp<=0)return {battle:next,events};
 const indirectGuard=abilityPreventsIndirectDamage(liveAttacker);if(indirectGuard){events.push({kind:'abilityTriggered',sourceId:liveAttacker.actorId,abilityId:indirectGuard.sourceId,effectId:indirectGuard.kind,trigger:`item:${effect.sourceId}`});return {battle:next,events};}
 const numerator=effect.numerator??1,denominator=effect.denominator??6,amount=Math.max(1,Math.floor(maxHp(liveAttacker)*numerator/denominator)),damaged=applyHpGroup(next,[{actorId:liveAttacker.actorId,delta:-amount}],effect.sourceId);next=damaged.battle;
 events.push(...damaged.events.map(event=>event.kind==='damage'?{...event,actorId:source.actorId,itemId:effect.sourceId,reason:'contact-retaliation'}:event));
 const after=unitById(next,liveAttacker.actorId);if(after?.hp>0){const threshold=resolveHpThresholdItems(next,{actorIds:[after.actorId],trigger:`contact-item:${effect.sourceId}`});next=threshold.battle;events.push(...threshold.events);}
 return {battle:next,events};
}

export function resolveAfterMoveItems(battle,{actorId,move,mechanics,totalDamage=0}={}){
 let next=clone(battle);const events=[];
 const forceSwitch=mechanics?.handlers?.some(handler=>handler?.id==='apply-forced-switch');
 if(!actorId||!move||!Number.isInteger(totalDamage)||totalDamage<=0||move.category==='status'||mechanics?.secondaryEffectsSuppressed===true||forceSwitch)return {battle:next,events};
 const actor=unitById(next,actorId);if(!actor||actor.hp<=0)return {battle:next,events};
 for(const effect of (actor.passiveEffects||[]).filter(effect=>effect?.sourceKind==='item'&&['item-damage-heal','item-post-move-recoil'].includes(effect.kind)&&heldItemEffectActive(actor,effect,next))){
  const current=unitById(next,actorId);if(!current||current.hp<=0)break;
  if(effect.kind==='item-damage-heal'){
   if(current.hp>=maxHp(current))continue;
   const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'damage-recovery',activationKey:`after-move:${next.turn}:${actorId}:${move.id}:${effect.sourceId}:${totalDamage}:heal`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
   const holder=unitById(next,actorId),numerator=effect.numerator??1,denominator=effect.denominator??8,amount=Math.max(1,Math.floor(totalDamage*numerator/denominator)),healed=applyHpGroup(next,[{actorId,delta:amount}],effect.sourceId);next=healed.battle;events.push(...healed.events.map(event=>event.kind==='heal'?{...event,actorId,itemId:effect.sourceId,reason:'damage-recovery',moveId:move.id}:event));
   continue;
  }
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'post-move-recoil',activationKey:`after-move:${next.turn}:${actorId}:${move.id}:${effect.sourceId}:${totalDamage}:recoil`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const holder=unitById(next,actorId);if(!holder||holder.hp<=0)continue;
  const indirectGuard=abilityPreventsIndirectDamage(holder);if(indirectGuard){events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:indirectGuard.sourceId,effectId:indirectGuard.kind,trigger:`item:${effect.sourceId}`,moveId:move.id});continue;}
  const numerator=effect.numerator??1,denominator=effect.denominator??10,amount=Math.max(1,Math.floor(maxHp(holder)*numerator/denominator)),damaged=applyHpGroup(next,[{actorId,delta:-amount}],effect.sourceId);next=damaged.battle;events.push(...damaged.events.map(event=>event.kind==='damage'?{...event,actorId,targetId:actorId,itemId:effect.sourceId,reason:'post-move-recoil',moveId:move.id}:event));
 }
 return {battle:next,events};
}

export function resolveTerrainSeedItems(battle,{actorIds=null,trigger='terrain-update'}={}){
 let next=clone(battle);const events=[],terrain=next.field?.terrain?.id;if(!terrain)return {battle:next,events};
 const ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){const target=unitById(next,actorId);if(!target||target.hp<=0)continue;const effect=itemEffects(target,'item-terrain-seed',next).find(effect=>effect.terrain===terrain);if(!effect)continue;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'terrain-seed',consume:true,activationKey:`terrain-seed:${next.turn}:${actorId}:${effect.sourceId}:${terrain}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId);current.stages??={};const stat=effect.stat,changed=abilityStageChange(current,effect.stages??1),requestedDelta=changed.requestedDelta,before=Number.isInteger(current.stages[stat])?current.stages[stat]:0,after=Math.max(-6,Math.min(6,before+requestedDelta));current.stages[stat]=after;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});const change={kind:'statStageChanged',actorId,targetId:actorId,stat,before,after,requestedDelta,originalRequestedDelta:changed.originalRequestedDelta,appliedDelta:after-before,reason:after===before?'stageLimit':'held-item',itemId:effect.sourceId};events.push(change);const copied=resolveOpponentStatGainCopyAbilities(next,{targetId:actorId,changes:[change],trigger:'held-item'});next=copied.battle;events.push(...copied.events);
 }
 return {battle:next,events};
}

export function resolvePpRestoreItems(battle,{actorIds=null,trigger='pp-update',preferredMoveId=null}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){const target=unitById(next,actorId);if(!target||target.hp<=0)continue;const effect=itemEffects(target,'item-pp-restore',next)[0];if(!effect)continue;
  const moveIds=target.buildSnapshot?.moveIds||Object.keys(target.pp||{}),moveId=(preferredMoveId&&target.pp?.[preferredMoveId]===0?preferredMoveId:null)||moveIds.find(id=>target.pp?.[id]===0);if(!moveId)continue;
  const maximum=target.maxPp?.[moveId];if(!Number.isInteger(maximum)||maximum<1)continue;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'pp-restore',consume:true,activationKey:`pp-restore:${next.turn}:${actorId}:${effect.sourceId}:${moveId}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId),before=current.pp[moveId],berryMultiplier=effect.sourceId?.endsWith('-berry')?abilityBerryEffectMultiplier(current):1,restoreAmount=(effect.amount??10)*berryMultiplier,after=Math.min(maximum,before+restoreAmount);current.pp[moveId]=after;events.push({kind:'ppRestored',actorId,moveId,itemId:effect.sourceId,ppBefore:before,ppAfter:after,amount:after-before,reason:'held-item',...(berryMultiplier>1?{abilityMultiplier:berryMultiplier}:{})});
 }
 return {battle:next,events};
}

export function resolveEntryItems(battle,switchEvents=[]){
 let next=clone(battle);const events=[];
 for(const entry of switchEvents||[]){if(entry?.kind!=='switchIn'||!entry.actorId)continue;const unit=unitById(next,entry.actorId);if(!unit||unit.hp<=0)continue;const airborne=itemEffects(unit,'item-airborne',next)[0];if(airborne){const revealed=revealHeldItem(next,{actorId:entry.actorId,itemId:airborne.sourceId,reason:'switch-in-airborne'});next=revealed.battle;events.push(...revealed.events);}}
 const seeds=resolveTerrainSeedItems(next,{actorIds:(switchEvents||[]).filter(event=>event?.kind==='switchIn').map(event=>event.actorId),trigger:'switch-in'});next=seeds.battle;events.push(...seeds.events);return {battle:next,events};
}

export function prepareOneShotMoveDamageItem(battle,{actorId,move,targetIds=[]}={}){
 let next=clone(battle);const events=[],actor=unitById(next,actorId);if(!actor||actor.hp<=0||!move)return {battle:next,multiplier:1,events};
 const effect=itemEffects(actor,'item-one-shot-damage-boost',next).find(effect=>effect.type===move.type);if(!effect)return {battle:next,multiplier:1,events};
 const qualifying=(targetIds||[]).some(targetId=>{const target=unitById(next,targetId);return target?.hp>0&&targetId!==actorId&&typeEffectivenessWithHeldItems(move.type,target,next,{attacker:unitById(next,actorId)})>0;});if(!qualifying)return {battle:next,multiplier:1,events};
 const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'one-shot-damage-boost',consume:true,activationKey:`one-shot-damage:${next.turn}:${actorId}:${move.id}:${effect.sourceId}`});next=activated.battle;events.push(...activated.events);return activated.applied?{battle:next,multiplier:effect.multiplier??1,itemId:effect.sourceId,events}:{battle:next,multiplier:1,events};
}

export function prepareConsecutiveMoveItem(battle,{actorId,move}={}){
 let next=clone(battle);const events=[],actor=unitById(next,actorId);if(!actor||actor.hp<=0||!move)return {battle:next,multiplier:1,events};
 actor.volatiles??={};const stateKey='item-consecutive-move';
 const declared=(actor.passiveEffects||[]).find(effect=>effect?.sourceKind==='item'&&effect.kind==='item-consecutive-move-power'),effect=itemEffects(actor,'item-consecutive-move-power',next)[0];
 if(move.category==='status'){if(declared&&actor.volatiles[stateKey]?.sourceItemId===declared.sourceId)delete actor.volatiles[stateKey];return {battle:next,multiplier:1,events};}
 if(!effect){if(declared&&actor.volatiles[stateKey]?.sourceItemId===declared.sourceId)delete actor.volatiles[stateKey];return {battle:next,multiplier:1,events};}
 const prior=actor.volatiles[stateKey],same=prior?.sourceItemId===effect.sourceId&&prior.moveId===move.id,count=same?Math.max(0,prior.count||0):0,increment=effect.increment??0.2,maxMultiplier=effect.maxMultiplier??2,multiplier=Math.min(maxMultiplier,1+increment*count);
 actor.volatiles[stateKey]={id:stateKey,sourceItemId:effect.sourceId,moveId:move.id,count:Math.min(Math.ceil((maxMultiplier-1)/increment)+1,count+1)};
 return {battle:next,multiplier,itemId:multiplier>1?effect.sourceId:null,events};
}

export function resolveFlinchItems(battle,{actorId,move,mechanics,damagedTargetIds=[]}={},runtime={}){
 let next=clone(battle);const events=[],actor=unitById(next,actorId);if(!actor||actor.hp<=0||!move||move.category==='status')return {battle:next,events};
 const effect=itemEffects(actor,'item-flinch-chance',next)[0];if(!effect)return {battle:next,events};
 const naturalFlinch=(mechanics?.secondaryEffects||[]).some(entry=>entry?.kind==='volatile-status'&&entry.volatile==='flinch');if(naturalFlinch||mechanics?.secondaryEffectsSuppressed===true)return {battle:next,events};
 if(typeof runtime.nextRandom!=='function'&&(damagedTargetIds||[]).some(id=>unitById(next,id)?.hp>0))throw new Error('flinch item resolution requires seeded nextRandom');
 for(const targetId of [...new Set(damagedTargetIds||[])]){
  const target=unitById(next,targetId);if(!target||target.hp<=0)continue;if(abilityBlocksSecondaryEffects(target)){events.push({kind:'secondaryEffectBlocked',actorId,targetId,moveId:move.id,itemId:effect.sourceId,abilityId:target.passiveEffects.find(entry=>entry.sourceKind==='ability'&&entry.kind==='secondary-effect-immunity')?.sourceId});continue;}const volatileBlock=abilityVolatileBlock(target,'flinch',next);if(volatileBlock){events.push({kind:'volatileFailed',actorId,targetId,moveId:move.id,volatile:'flinch',itemId:effect.sourceId,...volatileBlock});continue;}if(runtime.nextRandom()>=effect.chance)continue;target.volatiles??={};
  if(target.volatiles.flinch){events.push({kind:'volatileFailed',actorId,targetId,moveId:move.id,volatile:'flinch',itemId:effect.sourceId,reason:'alreadyVolatile'});continue;}
  target.volatiles.flinch={id:'flinch',sourceId:move.id,timer:1};events.push({kind:'volatileApplied',actorId,targetId,moveId:move.id,volatile:'flinch',itemId:effect.sourceId,reason:'held-item'});
 }
 return {battle:next,events};
}

export function resolveReactiveSwitchItems(battle,{actorId,move,mechanics,damagedTargetIds=[]}={},runtime={}){
 let next=clone(battle);const events=[];if(!actorId||!move||move.category==='status'||mechanics?.handlers?.some(handler=>handler?.id==='apply-forced-switch'))return {battle:next,events};
 for(const targetId of damagedTargetIds||[]){
  const target=unitById(next,targetId);if(!target||target.hp<=0)continue;
  const holderSwitch=itemEffects(target,'item-holder-switch',next)[0];
  if(holderSwitch){
   const requested=requestForcedReplacement(next,{actorId:targetId,reason:'held-item',itemId:holderSwitch.sourceId});if(!requested.requested)continue;
   const activated=activateHeldItem(requested.battle,{actorId:targetId,itemId:holderSwitch.sourceId,reason:'holder-switch',consume:true,activationKey:`holder-switch:${next.turn}:${targetId}:${move.id}`});if(!activated.applied)continue;next=activated.battle;events.push(...activated.events,{kind:'forcedReplacementRequested',actorId:targetId,itemId:holderSwitch.sourceId,triggerMoveId:move.id,side:requested.request.side,slot:requested.request.slot});continue;
  }
  const actor=unitById(next,actorId);if(!actor||actor.hp<=0)continue;const effect=itemEffects(target,'item-force-attacker-switch',next)[0];if(!effect)continue;
  const actorSide=['A','B'].find(side=>next.sides?.[side]?.active?.includes(actorId));if(!actorSide)continue;const reserves=(next.sides?.[actorSide]?.roster||[]).filter(unit=>unit.hp>0&&!next.sides[actorSide].active.includes(unit.actorId));if(!reserves.length)continue;
  const activated=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'force-attacker-switch',consume:true,activationKey:`force-attacker-switch:${next.turn}:${targetId}:${actorId}:${move.id}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const switched=applyForcedSwitches(next,{actorId:targetId,targetIds:[actorId],moveId:effect.sourceId,requireDamage:false,totalDamage:1},runtime);next=switched.battle;events.push(...switched.events.map(event=>({...event,itemId:effect.sourceId,triggerMoveId:move.id})));
  if(switched.succeeded)break;
 }
 return {battle:next,events};
}


export function prepareTurnOrderItems(battle,actions=[],runtime={}){
 let next=clone(battle);const events=[],prepared=(actions||[]).map(action=>({...action}));
 const ordered=[...prepared].filter(action=>action?.kind==='move').sort((left,right)=>String(left.actorId).localeCompare(String(right.actorId)));
 for(const action of ordered){
  const actor=unitById(next,action.actorId);if(!actor||actor.hp<=0)continue;const effect=itemEffects(actor,'item-quick-order',next)[0];if(!effect)continue;
  if(typeof runtime.nextRandom!=='function')throw new Error('quick-order item preparation requires seeded nextRandom');
  if(runtime.nextRandom()>=effect.chance)continue;
  const actual=prepared.find(entry=>entry.actorId===action.actorId);if(!actual)continue;actual.orderBoost=1;
  const activated=activateHeldItem(next,{actorId:action.actorId,itemId:effect.sourceId,reason:'turn-order',consume:false,activationKey:`turn-order:${next.turn}:${action.actorId}:${effect.sourceId}`});next=activated.battle;events.push(...activated.events);
 }
 return {battle:next,actions:prepared,events};
}
