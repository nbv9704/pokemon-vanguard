import {clone} from '../../rules-v3/battle-state.mjs';
import {effectiveWeatherId} from '../ability-field.mjs';

export const modifyChargePowerHandler={
 id:'modify-charge-power',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),weather=effectiveWeatherId(next);
  if(weather!=='rain'||params.rainMultiplier!==0.5)return {battle:next,payload,events:[]};
  const power=Math.max(1,Math.floor(payload.move.power*params.rainMultiplier));
  return {battle:next,payload:{...payload,move:{...payload.move,power}},events:[{kind:'movePowerModified',actorId:payload.action.actorId,moveId:payload.move.id,power,reason:'rain'}]};
 }
};
