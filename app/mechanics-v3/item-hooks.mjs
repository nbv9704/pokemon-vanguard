import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {roomActive} from './rooms.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
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

export function activateHeldItem(battle,{actorId,itemId,reason,consume=false,activationKey=null}){
 const next=clone(battle),unit=unitById(next,actorId);if(!unit||unit.hp<=0)return {battle:next,applied:false,events:[]};
 const state=ensureItemState(unit),effect={sourceKind:'item',sourceId:itemId};
 if(!heldItemEffectActive(unit,effect,next))return {battle:next,applied:false,events:[]};
 if(activationKey&&state.lastActivationKey===activationKey)return {battle:next,applied:false,idempotent:true,events:[]};
 const events=[];if(!state.revealed){state.revealed=true;events.push({kind:'itemRevealed',sourceId:actorId,itemId,reason});}
 state.activationCount++;state.lastActivationKey=activationKey||null;events.push({kind:'itemActivated',sourceId:actorId,itemId,reason,activationCount:state.activationCount});
 if(consume){state.consumed=true;events.push({kind:'itemConsumed',sourceId:actorId,itemId,reason});}
 return {battle:next,applied:true,events};
}

export function applySurvivalItemToMoveDamage(battle,{targetId,damage,moveId}){
 const target=unitById(battle,targetId);if(!target||target.hp<=0||!Number.isInteger(damage)||damage<target.hp)return {battle:clone(battle),damage,events:[]};
 const effect=itemEffects(target,'item-survive-lethal-hit',battle)[0];if(!effect)return {battle:clone(battle),damage,events:[]};
 if(effect.requireFullHp!==false&&target.hp!==maxHp(target))return {battle:clone(battle),damage,events:[]};
 const activated=activateHeldItem(battle,{actorId:targetId,itemId:effect.sourceId,reason:'survive-lethal-hit',consume:true,activationKey:`damage:${battle.turn}:${targetId}:${moveId}:${target.hp}`});
 return activated.applied?{battle:activated.battle,damage:Math.max(0,target.hp-1),events:activated.events,itemId:effect.sourceId}:{battle:activated.battle,damage,events:activated.events};
}

export function resolveHpThresholdItems(battle,{actorIds=null,trigger='state-update'}={}){
 let next=clone(battle);const events=[],ids=actorIds?[...new Set(actorIds)]:['A','B'].flatMap(side=>activeUnits(next,side).map(({unit})=>unit.actorId));
 for(const targetId of ids){
  const target=unitById(next,targetId);if(!target||target.hp<=0)continue;
  const effect=itemEffects(target,'item-threshold-heal',next)[0];if(!effect)continue;
  const thresholdNumerator=effect.thresholdNumerator??1,thresholdDenominator=effect.thresholdDenominator??2;if(target.hp*thresholdDenominator>maxHp(target)*thresholdNumerator)continue;
  const activated=activateHeldItem(next,{actorId:targetId,itemId:effect.sourceId,reason:'hp-threshold',consume:true,activationKey:`threshold:${next.turn}:${targetId}:${effect.sourceId}:${target.hp}:${trigger}`});next=activated.battle;events.push(...activated.events);if(!activated.applied)continue;
  const current=unitById(next,targetId),numerator=effect.healNumerator??1,denominator=effect.healDenominator??4,amount=Math.max(1,Math.floor(maxHp(current)*numerator/denominator)),healed=applyHpGroup(next,[{actorId:targetId,delta:amount}],effect.sourceId);next=healed.battle;events.push(...healed.events);
 }
 return {battle:next,events};
}

export function resolvePostDamageItems(battle,{targetId,moveId}){return resolveHpThresholdItems(battle,{actorIds:[targetId],trigger:`move:${moveId}`});}

function statusId(unit){return unit?.status?.id||unit?.status||null;}

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
