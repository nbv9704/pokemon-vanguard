import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {passiveEffectActive} from './passive-effects.mjs';
import {abilitySideConditionBypass} from './ability-hooks.mjs';

export const SIDE_CONDITION_IDS=['tailwind','reflect','light-screen','aurora-veil','safeguard'];
const maxScreenTurns=(battle,unit,condition,defaultTurns)=>{
 const effect=(unit?.passiveEffects||[]).find(entry=>passiveEffectActive(entry,battle,unit)&&entry.kind==='screen-duration'&&entry.conditions?.includes(condition));
 return {remaining:effect?.turns||defaultTurns,sourceItemId:effect?.sourceId};
};

export function actorSide(battle,actorId){
 return ['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
}

export function applySideCondition(battle,{actorId,moveId,condition,defaultTurns}){
 if(!SIDE_CONDITION_IDS.includes(condition))throw new Error(`unsupported side condition: ${condition}`);
 const next=clone(battle),side=actorSide(next,actorId),actor=unitById(next,actorId);
 if(!side||!actor||actor.hp<=0)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 next.sides[side].conditions??={};
 if(next.sides[side].conditions[condition])return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'sideConditionAlreadyActive',condition}]};
 const duration=maxScreenTurns(next,actor,condition,defaultTurns);
 next.sides[side].conditions[condition]={id:condition,remaining:duration.remaining,sourceActorId:actorId,sourceMoveId:moveId};
 return {battle:next,applied:true,events:[{kind:'sideConditionApplied',actorId,moveId,side,condition,remaining:duration.remaining,...(duration.sourceItemId?{sourceItemId:duration.sourceItemId}:{})}]};
}

export function speedWithSideConditions(speed,unit,battle){
 const side=actorSide(battle,unit?.actorId);
 return side&&battle.sides[side].conditions?.tailwind?Math.floor(speed*2):speed;
}

export function sideConditionDamageModifiers(battle,defender,move,critical=false,attacker=null){
 if(critical)return {values:[],applied:[]};
 const side=actorSide(battle,defender?.actorId),categoryScreen=move?.category==='physical'?'reflect':move?.category==='special'?'light-screen':null;if(!side||!categoryScreen)return {values:[],applied:[]};
 const active=[categoryScreen,'aurora-veil'].filter(condition=>battle.sides[side].conditions?.[condition]);if(!active.length)return {values:[],applied:[]};
 const bypassed=[];for(const condition of active){const bypass=abilitySideConditionBypass(attacker,condition);if(bypass){bypassed.push({sourceKind:'ability',sourceId:bypass.sourceId,kind:bypass.kind,condition,bypassed:true});continue;}const multiplier=battle.format==='double'?2732/4096:.5;return {values:[multiplier],applied:[...bypassed,{sourceKind:'side-condition',sourceId:condition,kind:'screen-damage-reduction',multiplier}]};}
 return {values:[],applied:bypassed};
}
