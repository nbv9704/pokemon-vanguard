import {gravityActive} from '../gravity.mjs';

export const prepareGravityPowerHandler={
 id:'prepare-gravity-power',hooks:['onMove'],
 run({battle,payload,params={}}){
  if(!gravityActive(battle))return {battle,payload,events:[]};const multiplier=params.multiplier??1.5;if(!(multiplier>0))throw new Error('prepare-gravity-power requires a positive multiplier');
  const power=Math.max(1,Math.floor(payload.move.power*multiplier));return {battle,payload:{...payload,move:{...payload.move,power},gravityPowerMultiplier:multiplier},events:[{kind:'movePowerChanged',actorId:payload.action.actorId,moveId:payload.move.id,fromPower:payload.move.power,toPower:power,reason:'gravity'}]};
 }
};
