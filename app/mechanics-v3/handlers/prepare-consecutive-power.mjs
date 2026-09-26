import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const prepareConsecutivePowerHandler={
 id:'prepare-consecutive-power',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload,events};
  actor.volatiles??={};const stateId=params.stateId||`${move.id}-chain`,prior=actor.volatiles[stateId],previousHit=actor.lastMoveOutcome?.moveId===move.id&&actor.lastMoveOutcome?.turn===next.turn-1&&actor.lastMoveOutcome.result===true,priorMultiplier=Number.isInteger(prior?.multiplier)?prior.multiplier:1,maxMultiplier=Number.isInteger(params.maxMultiplier)?params.maxMultiplier:4,multiplier=previousHit?Math.min(maxMultiplier,priorMultiplier*2):1;
  actor.volatiles[stateId]={id:stateId,sourceId:move.id,multiplier,endTurnTimer:2};
  const nextMove={...move,power:Math.max(1,Math.floor(move.power*multiplier))};
  if(multiplier!==1)events.push({kind:'movePowerChanged',actorId:actor.actorId,moveId:move.id,fromPower:move.power,toPower:nextMove.power,reason:'consecutive-hit',multiplier});
  return {battle:next,payload:{...payload,move:nextMove},events};
 }
};
