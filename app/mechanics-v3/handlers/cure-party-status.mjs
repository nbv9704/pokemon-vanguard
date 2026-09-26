import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;
const soundImmune=unit=>(unit?.passiveEffects||[]).find(effect=>effect?.sourceKind==='ability'&&effect.kind==='move-tag-immunity'&&effect.tag==='sound')||null;

export const curePartyStatusHandler={
 id:'cure-party-status',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),side=sideOf(next,action.actorId),events=[],curedTargetIds=[];if(!actor||actor.hp<=0||!side)return {battle:next,payload:{...payload,curedTargetIds},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const activeIds=new Set(next.sides[side].active||[]);
  for(const target of next.sides[side].roster||[]){const status=target.status?.id||target.status||null;if(target.hp<=0||!status)continue;const immunity=params.sound===true&&target.actorId!==actor.actorId&&activeIds.has(target.actorId)?soundImmune(target):null;if(immunity){events.push({kind:'abilityTriggered',sourceId:target.actorId,abilityId:immunity.sourceId,effectId:immunity.kind,moveId:move.id},{kind:'moveBlocked',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,reason:'ability',abilityId:immunity.sourceId});continue;}target.status=null;curedTargetIds.push(target.actorId);events.push({kind:'statusCured',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,status,reason:'partyCure'});}
  return {battle:next,payload:{...payload,curedTargetIds},events};
 }
};
