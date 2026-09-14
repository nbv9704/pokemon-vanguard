import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {MAJOR_STATUS_IDS} from './manifest-contract.mjs';
import {terrainMajorStatusBlockReason} from './terrain.mjs';
import {abilityStatusBlock} from './ability-hooks.mjs';
import {resolveStatusCureItems} from './item-hooks.mjs';

const intrinsicImmunities={
 burn:['fire'],
 paralysis:['electric'],
 poison:['poison','steel'],
 sleep:[],
 freeze:['ice'],
 'bad-poison':['poison','steel']
};

export function majorStatusBlockReason(status,target,blockedTargetTypes=[],battle=null){
 if(!MAJOR_STATUS_IDS.includes(status))throw new Error(`unsupported major status: ${status}`);
 if(target.status)return 'alreadyStatus';
 const abilityReason=battle&&abilityStatusBlock(battle,target,status);if(abilityReason)return abilityReason.reason;
 const terrainReason=battle&&terrainMajorStatusBlockReason(battle,target,status);if(terrainReason)return terrainReason;
 const types=new Set(target.types||[]);
 if(intrinsicImmunities[status].some(type=>types.has(type))||blockedTargetTypes.some(type=>types.has(type)))return 'typeImmune';
 return null;
}

function initialStatusState(status,moveId,runtime){
 const state={id:status,sourceId:moveId,turnsActive:0};
 if(status==='sleep'){
  if(typeof runtime?.nextRandom!=='function')throw new Error('sleep application requires seeded nextRandom');
  state.turnsRemaining=1+Math.floor(runtime.nextRandom()*3);
 }
 if(status==='bad-poison')state.toxicCounter=0;
 return state;
}

export function applyMajorStatus(battle,{actorId,targetId,moveId,status,blockedTargetTypes=[]},runtime={}){
 const next=clone(battle),target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason:'targetUnavailable'}]};
 const abilityBlock=abilityStatusBlock(next,target,status),reason=majorStatusBlockReason(status,target,blockedTargetTypes,next);
 if(reason)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason,...(reason==='abilityBlocked'&&abilityBlock?.sourceAbilityId?{sourceAbilityId:abilityBlock.sourceAbilityId}:{})}]};
 target.status=initialStatusState(status,moveId,runtime);
 const cured=resolveStatusCureItems(next,{actorIds:[targetId],trigger:`major-status:${moveId}:${status}`});
 return {battle:cured.battle,events:[{kind:'statusApplied',actorId,targetId,moveId,status},...cured.events]};
}
