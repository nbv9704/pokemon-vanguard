import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilityIgnoresParalysisSpeedPenalty} from './ability-hooks.mjs';

const prevented=(battle,actorId,status,details={})=>({cancelled:true,battle,events:[{kind:'actionPrevented',actorId,status,...details}]});
const cured=(battle,actorId,status)=>({cancelled:false,battle,events:[{kind:'statusCured',actorId,status,reason:'naturalRecovery'}]});

export function speedWithMajorStatus(speed,unit){
 if(!Number.isFinite(speed)||speed<0)throw new Error('speed must be a non-negative number');
 return (unit?.status?.id==='paralysis'||unit?.status==='paralysis')&&!abilityIgnoresParalysisSpeedPenalty(unit)?Math.floor(speed/2):speed;
}

export function tryMajorStatusAction(battle,action,runtime={}){
 const next=clone(battle),unit=unitById(next,action.actorId),status=unit?.status?.id||unit?.status;
 if(status==='sleep'){
  const remaining=unit.status.turnsRemaining??0;
  if(remaining>0){unit.status.turnsRemaining=remaining-1;return prevented(next,action.actorId,status,{turnsRemaining:remaining-1});}
  unit.status=null;return cured(next,action.actorId,status);
 }
 if(status==='freeze'){
  if(typeof runtime.nextRandom!=='function')throw new Error('freeze action gate requires seeded nextRandom');
  if(runtime.nextRandom()<.2){unit.status=null;return cured(next,action.actorId,status);}
  return prevented(next,action.actorId,status);
 }
 if(status==='paralysis'){
  if(typeof runtime.nextRandom!=='function')throw new Error('paralysis action gate requires seeded nextRandom');
  if(runtime.nextRandom()<.25)return prevented(next,action.actorId,status);
 }
 return {cancelled:false,battle:next,events:[]};
}

export function majorStatusTurnOptions(){
 return {getSpeed:(battle,action)=>speedWithMajorStatus(action.speed,unitById(battle,action.actorId))};
}
