import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {MAJOR_STATUS_IDS} from './manifest-contract.mjs';
import {terrainMajorStatusBlockReason} from './terrain.mjs';
import {abilitySideConditionBypass,abilityStatusBlock,abilityStatusReflect,abilityStatusTypeImmunityBypass} from './ability-hooks.mjs';
import {actorSide} from './side-conditions.mjs';
import {resolveStatusCureItems} from './item-hooks.mjs';

const intrinsicImmunities={
 burn:['fire'],
 paralysis:['electric'],
 poison:['poison','steel'],
 sleep:[],
 freeze:['ice'],
 'bad-poison':['poison','steel']
};

export function majorStatusBlockReason(status,target,blockedTargetTypes=[],battle=null,source=null,{ignoreTargetAbility=false}={}){
 if(!MAJOR_STATUS_IDS.includes(status))throw new Error(`unsupported major status: ${status}`);
 if(target.status)return 'alreadyStatus';
 const sourceSide=battle&&source?actorSide(battle,source.actorId):null,targetSide=battle?actorSide(battle,target.actorId):null;if(source&&source.actorId!==target.actorId&&sourceSide&&targetSide&&sourceSide!==targetSide&&battle.sides?.[targetSide]?.conditions?.safeguard&&!abilitySideConditionBypass(source,'safeguard'))return 'safeguard';
 const abilityReason=!ignoreTargetAbility&&battle&&abilityStatusBlock(battle,target,status,{sourceId:source?.actorId||null});if(abilityReason)return abilityReason.reason;
 const terrainReason=battle&&terrainMajorStatusBlockReason(battle,target,status);if(terrainReason)return terrainReason;
 const types=new Set(target.types||[]);
 const matchedTypes=[...new Set([...intrinsicImmunities[status],...blockedTargetTypes])].filter(type=>types.has(type));
 if(matchedTypes.length){const bypass=source&&abilityStatusTypeImmunityBypass(source,status,target);if(!bypass||matchedTypes.some(type=>!(bypass.targetTypes||[]).includes(type)))return 'typeImmune';}
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

export function applyMajorStatus(battle,{actorId,targetId,moveId,status,blockedTargetTypes=[],reflected=false,ignoreTargetAbility=false},runtime={}){
 let next=clone(battle);const target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason:'targetUnavailable'}]};
 const source=unitById(next,actorId),abilityBlock=ignoreTargetAbility?null:abilityStatusBlock(next,target,status,{sourceId:actorId}),reason=majorStatusBlockReason(status,target,blockedTargetTypes,next,source,{ignoreTargetAbility});
 if(reason)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason,...(reason==='abilityBlocked'&&abilityBlock?.sourceAbilityId?{sourceAbilityId:abilityBlock.sourceAbilityId}:{})}]};
 target.status=initialStatusState(status,moveId,runtime);
 const events=[{kind:'statusApplied',actorId,targetId,moveId,status}];
 const reflectEffect=!ignoreTargetAbility&&!reflected&&actorId!==targetId?abilityStatusReflect(target,status):null,reflectSource=reflectEffect?unitById(next,actorId):null;
 if(reflectEffect&&reflectSource?.hp>0){events.push({kind:'abilityTriggered',sourceId:targetId,abilityId:reflectEffect.sourceId,effectId:reflectEffect.kind,targetId:actorId,status});const applied=applyMajorStatus(next,{actorId:targetId,targetId:actorId,moveId:`ability:${reflectEffect.sourceId}`,status,reflected:true},runtime);next=applied.battle;events.push(...applied.events.map(event=>({...event,sourceAbilityId:reflectEffect.sourceId,reflected:true})));}
 const cured=resolveStatusCureItems(next,{actorIds:[targetId],trigger:`major-status:${moveId}:${status}`});
 return {battle:cured.battle,events:[...events,...cured.events]};
}
