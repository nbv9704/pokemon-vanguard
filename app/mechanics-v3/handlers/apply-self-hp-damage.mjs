import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {resolveHpThresholdItems} from '../item-hooks.mjs';

export const applySelfHpDamageHandler={
 id:'apply-self-hp-damage',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId);
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,selfHpDamage:0},events:[]};
  const maxHp=actor.maxHp??actor.stats?.hp,raw=maxHp*params.numerator/params.denominator,amount=params.rounding==='round'?Math.round(raw):params.rounding==='ceil'?Math.ceil(raw):Math.floor(raw);
  const applied=applyHpGroup(next,[{actorId:actor.actorId,delta:-Math.max(1,amount)}],`move:${move.id}:self-damage`);next=applied.battle;const events=applied.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id,selfDamage:true}));
  if(unitById(next,actor.actorId)?.hp>0){const threshold=resolveHpThresholdItems(next,{actorIds:[actor.actorId],trigger:`move:${move.id}:self-damage`});next=threshold.battle;events.push(...threshold.events);}
  return {battle:next,payload:{...payload,selfHpDamage:applied.events.find(event=>event.kind==='damage')?.amount||0},events};
 }
};
