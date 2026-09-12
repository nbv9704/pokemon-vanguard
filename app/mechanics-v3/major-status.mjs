import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {MAJOR_STATUS_IDS} from './manifest-contract.mjs';

export const MAJOR_STATUSES=MAJOR_STATUS_IDS;

const intrinsicImmunities={burn:['fire'],paralysis:['electric'],poison:['poison','steel']};
const maxHp=unit=>unit.maxHp??unit.stats?.hp;

export function majorStatusBlockReason(status,target,blockedTargetTypes=[]){
 if(!MAJOR_STATUSES.includes(status))throw new Error(`unsupported major status: ${status}`);
 if(target.status)return 'alreadyStatus';
 const types=new Set(target.types||[]);
 if(intrinsicImmunities[status].some(type=>types.has(type))||blockedTargetTypes.some(type=>types.has(type)))return 'typeImmune';
 return null;
}

export function applyMajorStatus(battle,{actorId,targetId,moveId,status,blockedTargetTypes=[]}){
 const next=clone(battle),target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason:'targetUnavailable'}]};
 const reason=majorStatusBlockReason(status,target,blockedTargetTypes);
 if(reason)return {battle:next,events:[{kind:'statusFailed',actorId,targetId,moveId,status,reason}]};
 target.status={id:status,sourceId:moveId,turnsActive:0};
 return {battle:next,events:[{kind:'statusApplied',actorId,targetId,moveId,status}]};
}

export function speedWithMajorStatus(speed,unit){
 if(!Number.isFinite(speed)||speed<0)throw new Error('speed must be a non-negative number');
 return unit?.status?.id==='paralysis'||unit?.status==='paralysis'?Math.floor(speed/2):speed;
}

export function tryMajorStatusAction(battle,action,runtime={}){
 const unit=unitById(battle,action.actorId),status=unit?.status?.id||unit?.status;
 if(status!=='paralysis')return {cancelled:false,battle:clone(battle),events:[]};
 if(typeof runtime.nextRandom!=='function')throw new Error('paralysis action gate requires seeded nextRandom');
 const prevented=runtime.nextRandom()<.25;
 return {cancelled:prevented,battle:clone(battle),events:prevented?[{kind:'actionPrevented',actorId:action.actorId,status:'paralysis'}]:[]};
}

export function majorStatusEndTurnGroup(battle){
 const changes=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){
  const status=unit.status?.id||unit.status,limit=maxHp(unit);
  if(status==='burn')changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(limit/16))});
  if(status==='poison')changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(limit/8))});
 }
 return {id:'major-status-residual',changes};
}

export function majorStatusTurnOptions(){
 return {getSpeed:(battle,action)=>speedWithMajorStatus(action.speed,unitById(battle,action.actorId))};
}

export function resolveMajorStatusEndTurn(battle,groups=[]){
 return resolveEndTurn(battle,[...groups,majorStatusEndTurnGroup(battle)]);
}
