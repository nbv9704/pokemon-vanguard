import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyRechargeHandler={
 id:'apply-recharge',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),requireDamage=params.requireDamage!==false;
  if(!actor||actor.hp<=0||requireDamage&&!(payload.totalDamage>0))return {battle:next,payload,events:[]};
  actor.volatiles=actor.volatiles||{};actor.volatiles['must-recharge']={id:'must-recharge',moveId:payload.move.id,startedTurn:next.turn};
  return {battle:next,payload:{...payload,rechargeApplied:true},events:[{kind:'rechargeRequired',actorId:actor.actorId,moveId:payload.move.id}]};
 }
};
