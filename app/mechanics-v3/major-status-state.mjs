import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {MAJOR_STATUS_IDS} from './manifest-contract.mjs';

const intrinsicImmunities={
 burn:['fire'],
 paralysis:['electric'],
 poison:['poison','steel'],
 sleep:[],
 freeze:['ice'],
 'bad-poison':['poison','steel']
};

export function majorStatusBlockReason(status,target,blockedTargetTypes=[]){
 if(!MAJOR_STATUS_IDS.includes(status))throw new Error(`unsupported major status: ${status}`);
 if(target.status)return 'alreadyStatus';
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
 const reason=majorStatusBlockReason(status,target,blockedTargetTypes);
 if(reason)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason}]};
 target.status=initialStatusState(status,moveId,runtime);
 return {battle:next,events:[{kind:'statusApplied',actorId,targetId,moveId,status}]};
}
