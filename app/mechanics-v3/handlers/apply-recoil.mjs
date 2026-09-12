import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyRecoilHandler={
 id:'apply-recoil',hooks:['onMove'],
 run({battle,payload,params}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),totalDamage=payload.totalDamage||0;
  if(!actor||actor.hp<=0||totalDamage<=0)return {battle:next,payload,events:[]};
  const requested=Math.max(1,Math.round(totalDamage*params.numerator/params.denominator)),hpBefore=actor.hp,amount=Math.min(hpBefore,requested);actor.hp-=amount;
  const events=[{kind:'damage',actorId:actor.actorId,targetId:actor.actorId,moveId:move.id,source:'recoil',hpBefore,hpAfter:actor.hp,amount}];
  if(actor.hp===0)events.push({kind:'fainted',targetId:actor.actorId,source:'recoil'});
  return {battle:next,payload:{...payload,recoilDamage:amount},events};
 }
};
