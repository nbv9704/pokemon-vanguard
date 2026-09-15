import {clone} from '../../rules-v3/battle-state.mjs';
import {effectiveWeatherId} from '../ability-field.mjs';

export const requireFieldStateHandler={
 id:'require-field-state',hooks:['onTryMove'],
 run({battle,payload,params}){
  const next=clone(battle),weather=effectiveWeatherId(next),terrain=next.field?.terrain?.id||null;
  const weatherOk=!params.weatherIds||(params.weatherIds||[]).includes(weather),terrainOk=params.terrain==='any'?Boolean(terrain):params.terrain?terrain===params.terrain:true;
  if(weatherOk&&terrainOk)return {battle:next,payload,events:[]};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason:'fieldRequirement',requiredWeatherIds:params.weatherIds||null,requiredTerrain:params.terrain||null}]};
 }
};
