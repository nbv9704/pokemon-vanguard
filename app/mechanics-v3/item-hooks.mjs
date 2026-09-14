import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {applyForcedSwitches} from './switching.mjs';
import {roomActive} from './rooms.mjs';
import {abilityBlocksSecondaryEffects,abilityVolatileBlock} from './ability-hooks.mjs';

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

export function activateHeldItem(battle,{actorId,itemId,reason,consume=false,activationKey=null,allowFainted=false}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||(!allowFainted&&unit.hp<=0))return {battle:next,applied:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};
 if(!heldItemEffectActive(unit,effect,next))return {battle:next,applied:false,events:[]};
 if(activationKey&&state.lastActivationKey===activationKey)return {battle:next,applied:false,idempotent:true,events:[]};
 const events=[];if(!state.revealed){state.revealed=true;events.push({kind:'itemRevealed',sourceId:actorId,itemId,reason});}
 state.activationCount++;state.lastActivationKey=activationKey||null;events.push({kind:'itemActivated',sourceId:actorId,itemId,reason,activationCount:state.activationCount});
 if(consume){state.consumed=true;events.push({kind:'itemConsumed',sourceId:actorId,itemId,reason});}
 return {battle:next,applied:true,events};
}


export function revealHeldItem(battle,{actorId,itemId,reason}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,revealed:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};if(!heldItemEffectActive(unit,effect,next)||state.revealed)return {battle:next,revealed:false,events:[]};
 state.revealed=true;return {battle:next,revealed:true,events:[{kind:'itemRevealed',sourceId:actorId,itemId,reason}]};
}

export function heldItemHasEffect(unit,kind,battle){return itemEffects(unit,kind,battle).length>0;}

export function typeEffectivenessWithHeldItems(attackType,defender,battle){
 if(!defender)return 1;
 if(attackType==='ground'&&heldItemHasEffect(defender,'item-airborne',battle))return 0;
 let types=[...(defender.types||[])];if(attackType==='ground'&&heldItemHasEffect(defender,'item-grounding',battle))types=types.filter(type=>type!=='flying');
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
 return activated.applied?{battle:activated.battle,multiplier:effect.multiplier??0.5,events:activated.events,itemId:effect.sourceId}:{battle:activated.battle,multiplier:1,events:activated.events};
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
  const thresholdNumerator=effect.thresholdNumerator??1,thresholdDenominator=effect.thresholdDenominator??2;if(target.hp*thresholdDenominator>maxHp(target)*thresholdNumerator)continue;
  const activated=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'hp-threshold',consume:true,activationKey:`threshold:${next.turn}:${targetId}:${effect.sourceId}:${target.hp}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,targetId),numerator=effect.healNumerator??1,denominator=effect.healDenominator??4,amount=Number.isInteger(effect.healAmount)?effect.healAmount:Math.max(1,Math.floor(maxHp(current)*numerator/denominator)),healed=applyHpGroup(next,[{actorId:targetId,delta:amount}],effect.sourceId);next=healed.battle;events.push(...healed.events);
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
  const numerator=effect.numerator??1,denominator=effect.denominator??10,amount=Math.max(1,Math.floor(maxHp(holder)*numerator/denominator)),damaged=applyHpGroup(next,[{actorId,delta:-amount}],effect.sourceId);next=damaged.battle;events.push(...damaged.events.map(event=>event.kind==='damage'?{...event,actorId,targetId:actorId,itemId:effect.sourceId,reason:'post-move-recoil',moveId:move.id}:event));
 }
 return {battle:next,events};
}

export function resolveTerrainSeedItems(battle,{actorIds=null,trigger='terrain-update'}={}){
 let next=clone(battle);const events=[],terrain=next.field?.terrain?.id;if(!terrain)return {battle:next,events};
 const ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){const target=unitById(next,actorId);if(!target||target.hp<=0)continue;const effect=itemEffects(target,'item-terrain-seed',next).find(effect=>effect.terrain===terrain);if(!effect)continue;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'terrain-seed',consume:true,activationKey:`terrain-seed:${next.turn}:${actorId}:${effect.sourceId}:${terrain}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId);current.stages??={};const stat=effect.stat,before=Number.isInteger(current.stages[stat])?current.stages[stat]:0,requestedDelta=effect.stages??1,after=Math.max(-6,Math.min(6,before+requestedDelta));current.stages[stat]=after;events.push({kind:'statStageChanged',actorId,targetId:actorId,stat,before,after,requestedDelta,appliedDelta:after-before,reason:after===before?'stageLimit':'held-item',itemId:effect.sourceId});
 }
 return {battle:next,events};
}

export function resolvePpRestoreItems(battle,{actorIds=null,trigger='pp-update',preferredMoveId=null}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const actorId of ids){const target=unitById(next,actorId);if(!target||target.hp<=0)continue;const effect=itemEffects(target,'item-pp-restore',next)[0];if(!effect)continue;
  const moveIds=target.buildSnapshot?.moveIds||Object.keys(target.pp||{}),moveId=(preferredMoveId&&target.pp?.[preferredMoveId]===0?preferredMoveId:null)||moveIds.find(id=>target.pp?.[id]===0);if(!moveId)continue;
  const maximum=target.maxPp?.[moveId];if(!Number.isInteger(maximum)||maximum<1)continue;
  const activated=activateHeldItem(next,{actorId,itemId:effect.sourceId,reason:'pp-restore',consume:true,activationKey:`pp-restore:${next.turn}:${actorId}:${effect.sourceId}:${moveId}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,actorId),before=current.pp[moveId],after=Math.min(maximum,before+(effect.amount??10));current.pp[moveId]=after;events.push({kind:'ppRestored',actorId,moveId,itemId:effect.sourceId,ppBefore:before,ppAfter:after,amount:after-before,reason:'held-item'});
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
 const qualifying=(targetIds||[]).some(targetId=>{const target=unitById(next,targetId);return target?.hp>0&&targetId!==actorId&&typeEffectivenessWithHeldItems(move.type,target,next)>0;});if(!qualifying)return {battle:next,multiplier:1,events};
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
  const target=unitById(next,targetId);if(!target||target.hp<=0)continue;if(abilityBlocksSecondaryEffects(target)){events.push({kind:'secondaryEffectBlocked',actorId,targetId,moveId:move.id,itemId:effect.sourceId,abilityId:target.passiveEffects.find(entry=>entry.sourceKind==='ability'&&entry.kind==='secondary-effect-immunity')?.sourceId});continue;}const volatileBlock=abilityVolatileBlock(target,'flinch');if(volatileBlock){events.push({kind:'volatileFailed',actorId,targetId,moveId:move.id,volatile:'flinch',itemId:effect.sourceId,...volatileBlock});continue;}if(runtime.nextRandom()>=effect.chance)continue;target.volatiles??={};
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
