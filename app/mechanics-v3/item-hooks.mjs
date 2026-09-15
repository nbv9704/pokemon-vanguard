import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {nextRandom} from '../rules-v3/rng.mjs';
import {applyForcedSwitches} from './switching.mjs';
import {abilityStageChange} from './ability-stage-change.mjs';
import {resolveOpponentStatGainCopyAbilities} from './ability-stage-response.mjs';
import {roomActive} from './rooms.mjs';
import {abilityBerryConsumptionHeal,abilityBerryEffectMultiplier,abilityBlocksSecondaryEffects,abilityGroundingImmunity,abilityPreventsIndirectDamage,abilitySuppressesHeldItems,abilityTypeImmunityBypass,abilityVolatileBlock,opposingBerrySuppression} from './ability-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const battleStageIds=['atk','def','spa','spd','spe','accuracy','evasion'];
const inferredItemId=unit=>{const buildItem=unit?.buildSnapshot?.itemId;if(buildItem&&buildItem!=='none')return buildItem;return unit?.passiveEffects?.find(effect=>effect?.sourceKind==='item')?.sourceId||null;};
const itemEffects=(unit,kind,battle)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='item'&&effect.kind===kind&&heldItemEffectActive(unit,effect,battle));

export function createHeldItemState(itemId){
 const heldItemId=itemId&&itemId!=='none'?itemId:null;
 return {heldItemId,consumed:false,revealed:false,activationCount:0,lastActivationKey:null};
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

function ensureItemState(unit){
 unit.itemState??=createHeldItemState(inferredItemId(unit));
 if(unit.itemState.heldItemId===undefined)unit.itemState.heldItemId=inferredItemId(unit);
 if(unit.itemState.consumed===undefined)unit.itemState.consumed=false;
 if(unit.itemState.revealed===undefined)unit.itemState.revealed=false;
 if(!Number.isInteger(unit.itemState.activationCount))unit.itemState.activationCount=0;
 if(unit.itemState.lastActivationKey===undefined)unit.itemState.lastActivationKey=null;
 return unit.itemState;
}

const abilityItemEffect=(unit,kind)=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind===kind)||null;
const itemEffectSnapshot=(unit,itemId)=>(unit?.passiveEffects||[]).filter(effect=>effect?.sourceKind==='item'&&effect.sourceId===itemId).map(effect=>structuredClone(effect));
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

function receiveTransferredItem(unit,itemId,effects,{revealed=true}={}){
 unit.passiveEffects=(unit.passiveEffects||[]).filter(effect=>effect?.sourceKind!=='item');
 unit.passiveEffects.push(...(effects||[]).map(effect=>structuredClone(effect)));
 unit.itemState=createHeldItemState(itemId);unit.itemState.revealed=revealed;unit.itemState.lostReason=null;
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

export function activateHeldItem(battle,{actorId,itemId,reason,consume=false,activationKey=null,allowFainted=false}){
 let next=clone(battle);let unit=unitById(next,actorId);if(!unit||(!allowFainted&&unit.hp<=0))return {battle:next,applied:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};
 if(!heldItemEffectActive(unit,effect,next))return {battle:next,applied:false,events:[]};
 if(consume&&itemId?.endsWith('-berry')){
  const suppression=opposingBerrySuppression(next,unit);if(suppression)return {battle:next,applied:false,events:[{kind:'abilityTriggered',sourceId:suppression.holder.actorId,abilityId:suppression.effect.sourceId,effectId:suppression.effect.kind,targetId:actorId},{kind:'itemActivationBlocked',sourceId:actorId,itemId,reason:'opponentAbility',abilityId:suppression.effect.sourceId}]};
 }
 if(activationKey&&state.lastActivationKey===activationKey)return {battle:next,applied:false,idempotent:true,events:[]};
 const events=[],consumedEffects=consume?itemEffectSnapshot(unit,itemId):[];if(!state.revealed){state.revealed=true;events.push({kind:'itemRevealed',sourceId:actorId,itemId,reason});}
 state.activationCount++;state.lastActivationKey=activationKey||null;events.push({kind:'itemActivated',sourceId:actorId,itemId,reason,activationCount:state.activationCount});
 if(consume){state.consumed=true;recordConsumedItem(unit,itemId,next,{reason,effects:consumedEffects});scheduleBerryReplay(unit,itemId,next,consumedEffects);events.push({kind:'itemConsumed',sourceId:actorId,itemId,reason});
  if(itemId?.endsWith('-berry')){const effect=abilityBerryConsumptionHeal(unit);if(effect&&unit.hp>0&&unit.hp<maxHp(unit)){const before=unit.hp,amount=Math.max(1,Math.floor(maxHp(unit)*effect.numerator/effect.denominator));unit.hp=Math.min(maxHp(unit),unit.hp+amount);events.push({kind:'abilityTriggered',sourceId:actorId,abilityId:effect.sourceId,effectId:effect.kind,itemId},{kind:'heal',targetId:actorId,hpBefore:before,hpAfter:unit.hp,amount:unit.hp-before,source:`ability:${effect.sourceId}`,abilityId:effect.sourceId,trigger:'berry-consumed'});}}
  const passed=resolveImmediateAllyItemPass(next,{actorId,reason});next=passed.battle;events.push(...passed.events);unit=unitById(next,actorId);
 }
 return {battle:next,applied:true,events};
}


export function revealHeldItem(battle,{actorId,itemId,reason,force=false}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,revealed:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};if((force?heldItemId(unit)!==itemId:!heldItemEffectActive(unit,effect,next))||state.revealed)return {battle:next,revealed:false,events:[]};
 state.revealed=true;return {battle:next,revealed:true,events:[{kind:'itemRevealed',sourceId:actorId,itemId,reason}]};
}

export function heldItemHasEffect(unit,kind,battle){return itemEffects(unit,kind,battle).length>0;}

export function typeEffectivenessWithHeldItems(attackType,defender,battle,{attacker=null,ignoreDefenderAbility=false}={}){
 if(!defender)return 1;
 const grounded=attackType==='ground'&&heldItemHasEffect(defender,'item-grounding',battle);
 if(attackType==='ground'&&!grounded&&(heldItemHasEffect(defender,'item-airborne',battle)||(!ignoreDefenderAbility&&abilityGroundingImmunity(defender))))return 0;
 let types=[...(defender.types||[])];if(grounded)types=types.filter(type=>type!=='flying');
 const bypass=attacker&&abilityTypeImmunityBypass(attacker,attackType,defender);if(bypass)types=types.filter(type=>!(bypass.targetTypes||[]).includes(type));
 return types.length?typeEffectiveness(attackType,types):1;
}

export function speedWithHeldItems(speed,unit,battle){
 const effects=[...itemEffects(unit,'item-speed-boost',battle),...itemEffects(unit,'item-speed-modifier',battle)],multiplier=effects.reduce((value,effect)=>value*(effect.multiplier??1),1);
 return multiplier===1?speed:Math.floor(speed*multiplier);
}

export function statWithHeldItems(value,unit,stat,battle){
 if(!Number.isFinite(value)||!unit||!['atk','spa'].includes(stat))return value;
 const baseSpeciesId=unit.baseSpeciesId||unit.speciesId,effects=itemEffects(unit,'item-species-stat-modifier',battle).filter(effect=>Array.isArray(effect.speciesIds)&&effect.speciesIds.includes(baseSpeciesId)&&Array.isArray(effect.stats)&&effect.stats.includes(stat));
 return effects.length?Math.floor(effects.reduce((current,effect)=>current*(effect.multiplier??1),value)):value;
}

export function accuracyWithHeldItems(accuracy,unit,battle,{target=null,targetHasActed=false,targetWillMove=null}={}){
 if(accuracy===null)return null;const boost=itemEffects(unit,'item-accuracy-boost',battle)[0],afterTarget=(targetWillMove===false||targetHasActed)?itemEffects(unit,'item-accuracy-after-target',battle)[0]:null,incoming=target?itemEffects(target,'item-incoming-accuracy-modifier',battle)[0]:null,multiplier=(boost?.multiplier??1)*(afterTarget?.multiplier??1)*(incoming?.multiplier??1);
 return multiplier===1?accuracy:Math.min(100,Math.floor(accuracy*multiplier));
}

export function healingWithHeldItems(amount,unit,battle,{source}={}){
 if(!Number.isInteger(amount)||amount<=0)return amount;const effect=itemEffects(unit,'item-healing-boost',battle).find(effect=>Array.isArray(effect.sources)&&effect.sources.includes(source));
 return effect?Math.max(1,Math.floor(amount*effect.multiplier)):amount;
}

export function criticalChanceWithHeldItems(unit,battle,{baseStage=0}={}){
 const speciesId=unit?.baseSpeciesId||unit?.speciesId,generic=itemEffects(unit,'item-critical-ratio',battle)[0],species=itemEffects(unit,'item-species-critical-ratio',battle).find(effect=>Array.isArray(effect.speciesIds)&&effect.speciesIds.includes(speciesId)),stage=Math.max(0,Math.min(3,baseStage+(generic?.stages??0)+(species?.stages??0)));
 return [1/24,1/8,1/2,1][stage];
}

export function validateChoiceItemMove(battle,action,move){
 if(action?.kind!=='move')return {ok:true};
 const unit=unitById(battle,action.actorId),lock=unit?.volatiles?.['choice-lock'];if(!unit||!lock?.moveId)return {ok:true};
 const effect=itemEffects(unit,'item-choice-lock',battle)[0];if(!effect)return {ok:true};
 if(lock.moveId!==move?.id)return {ok:false,code:'CHOICE_LOCKED_MOVE_REQUIRED',itemId:effect.sourceId,requiredMoveId:lock.moveId};
 return {ok:true};
}

export function applyChoiceItemMoveLock(battle,{actorId,moveId}={}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0||!moveId)return {battle:next,applied:false};
 const effect=itemEffects(unit,'item-choice-lock',next)[0];if(!effect)return {battle:next,applied:false};
 unit.volatiles??={};if(unit.volatiles['choice-lock']?.moveId)return {battle:next,applied:false};
 unit.volatiles['choice-lock']={id:'choice-lock',moveId,sourceItemId:effect.sourceId};
 return {battle:next,applied:true};
}


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
 for(const targetId of damagedTargetIds||[]){const target=unitById(next,targetId),actor=unitById(next,actorId);if(!target||target.hp<=0||!actor||actor.hp<=0)continue;const effect=itemEffects(target,'item-force-attacker-switch',next)[0];if(!effect)continue;
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

function statusId(unit){return unit?.status?.id||unit?.status||null;}


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
