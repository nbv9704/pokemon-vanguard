import {clone} from '../../rules-v3/battle-state.mjs';

export const clearTerrainHandler={
 id:'clear-terrain',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),terrain=next.field?.terrain?.id||null;if(!terrain)return {battle:next,payload,events:[]};
  if(params.requireDamage!==false&&!(payload.totalDamage>0))return {battle:next,payload,events:[]};
  delete next.field.terrain;
  return {battle:next,payload:{...payload,terrainCleared:terrain},events:[{kind:'terrainEnded',terrain,reason:'clearedByMove',actorId:payload.action.actorId,moveId:payload.move.id}]};
 }
};
