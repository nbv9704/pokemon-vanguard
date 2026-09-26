import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {abilityStatusBlock} from '../ability-hooks.mjs';
import {terrainMajorStatusBlockReason} from '../terrain.mjs';
import {resolveStatusCureItems} from '../item-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;

export const applyRestHandler={
 id:'apply-rest',hooks:['onMove'],
 run({battle,payload}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId),limit=maxHp(actor),status=actor?.status?.id||actor?.status||null;
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,restApplied:false},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(status==='sleep'||actor.hp>=limit)return {battle:next,payload:{...payload,restApplied:false},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:status==='sleep'?'alreadyAsleep':'fullHp'}]};
  const abilityBlock=abilityStatusBlock(next,actor,'sleep',{sourceId:actor.actorId}),terrainBlock=terrainMajorStatusBlockReason(next,actor,'sleep');if(abilityBlock||terrainBlock)return {battle:next,payload:{...payload,restApplied:false},events:[{kind:'statusFailed',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,status:'sleep',reason:abilityBlock?.reason||terrainBlock,...(abilityBlock?.sourceAbilityId?{sourceAbilityId:abilityBlock.sourceAbilityId}:{})},{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'sleepBlocked'}]};
  const events=[];if(status){actor.status=null;events.push({kind:'statusCured',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,status,reason:'rest'});}const hpBefore=actor.hp;actor.hp=limit;actor.status={id:'sleep',sourceId:move.id,turnsActive:0,turnsRemaining:3};events.push({kind:'statusApplied',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,status:'sleep'});if(actor.hp>hpBefore)events.push({kind:'heal',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,source:`move:${move.id}`,hpBefore,hpAfter:actor.hp,amount:actor.hp-hpBefore});
  const cured=resolveStatusCureItems(next,{actorIds:[actor.actorId],trigger:`major-status:${move.id}:sleep`});next=cured.battle;events.push(...cured.events);return {battle:next,payload:{...payload,restApplied:true,healedTargetIds:[actor.actorId]},events};
 }
};
