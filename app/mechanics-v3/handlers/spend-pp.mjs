import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {resolvePpRestoreItems} from '../item-hooks.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const pressureEffect=unit=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind==='target-pp-pressure')||null;

function pressureHolders(battle,payload){
 const {action,move,mechanics}=payload,actorSide=sideOf(battle,action.actorId);if(!actorSide||!mechanics?.targetMode)return [];
 const targets=resolveTargets(battle,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
 return targets.map(ref=>unitById(battle,ref.actorId)).filter(unit=>unit?.hp>0&&sideOf(battle,unit.actorId)!==actorSide).map(unit=>({unit,effect:pressureEffect(unit)})).filter(entry=>entry.effect);
}

export const spendPpHandler={
 id:'spend-pp',hooks:['onTryMove'],
 run({battle,payload}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),moveId=payload.move.id,remaining=actor?.pp?.[moveId];
  const rampageContinuation=actor?.volatiles?.rampage?.moveId===moveId;
  if(payload.skipPp===true||rampageContinuation)return {battle:next,payload:{...payload,ppSkipped:true},events:[{kind:'ppSpendSkipped',actorId:payload.action.actorId,moveId,reason:rampageContinuation?'rampageContinuation':'twoTurnRelease'}]};
  if(!Number.isInteger(remaining))throw new Error(`missing PP state for ${payload.action.actorId}:${moveId}`);
  if(remaining<=0)return {battle:next,payload:{...payload,cancelled:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId,reason:'noPP'}]};
  const holders=pressureHolders(next,payload),cost=1+holders.length,after=Math.max(0,remaining-cost);actor.pp[moveId]=after;
  const events=[...holders.map(({unit,effect})=>({kind:'abilityTriggered',sourceId:unit.actorId,abilityId:effect.sourceId,effectId:effect.kind,targetId:actor.actorId,moveId})),{kind:'ppSpent',actorId:actor.actorId,moveId,ppBefore:remaining,ppAfter:after,amount:remaining-after,...(holders.length?{pressureSources:holders.map(({unit})=>unit.actorId)}:{})}];
  if(after===0){const restored=resolvePpRestoreItems(next,{actorIds:[actor.actorId],preferredMoveId:moveId,trigger:`move:${moveId}`});events.push(...restored.events);return {battle:restored.battle,payload:{...payload,ppBefore:remaining,ppAfter:after},events};}
  return {battle:next,payload:{...payload,ppBefore:remaining,ppAfter:after},events};
 }
};
