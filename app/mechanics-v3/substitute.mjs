import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilitySideConditionBypass} from './ability-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const isSound=mechanics=>(mechanics?.tags||[]).includes('sound');

export function applySubstitute(battle,{actorId,moveId}){
 const next=clone(battle),actor=unitById(next,actorId);if(!actor||actor.hp<=0)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 actor.volatiles??={};if(actor.volatiles.substitute)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'substituteAlreadyActive'}]};
 const cost=Math.max(1,Math.floor(maxHp(actor)/4));if(actor.hp<=cost)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'insufficientHp'}]};
 const hpBefore=actor.hp;actor.hp-=cost;actor.volatiles.substitute={id:'substitute',hp:cost,maxHp:cost,sourceId:moveId};
 return {battle:next,applied:true,events:[{kind:'damage',actorId,targetId:actorId,moveId,hpBefore,hpAfter:actor.hp,amount:cost,source:'substitute-cost'},{kind:'substituteCreated',actorId,moveId,hp:cost}]};
}

export function substituteBypassed(actor,mechanics){return isSound(mechanics)||Boolean(abilitySideConditionBypass(actor,'substitute'));}

export function substituteBlocksStatusMove(target,actor,move,mechanics){return Boolean(target?.volatiles?.substitute&&move?.category==='status'&&!substituteBypassed(actor,mechanics));}

export function applySubstituteDamage(battle,{actorId,targetId,damage,moveId,mechanics,hit=null}={}){
 const next=clone(battle),actor=unitById(next,actorId),target=unitById(next,targetId),state=target?.volatiles?.substitute;if(!actor||!target||!state||!(damage>0)||substituteBypassed(actor,mechanics))return {battle:next,absorbed:false,amount:damage,events:[]};
 const before=state.hp,amount=Math.min(before,damage);state.hp-=amount;const events=[{kind:'substituteDamaged',actorId,targetId,moveId,hpBefore:before,hpAfter:state.hp,amount,...(hit===null?{}:{hit})}];if(state.hp<=0){delete target.volatiles.substitute;events.push({kind:'substituteBroken',actorId,targetId,moveId,...(hit===null?{}:{hit})});}
 return {battle:next,absorbed:true,amount,events};
}
