import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';

export const applySelfSacrificeHandler={
 id:'apply-self-sacrifice',hooks:['onMove'],
 run({battle,payload,params}){
  let next=clone(battle);const {action,move}=payload,actor=unitById(next,action.actorId);
  if(params.requireHit&&!(payload.hitTargetIds||[]).length)return {battle:next,payload:{...payload,selfSacrificed:false},events:[]};
  if(params.requireDamage&&!(payload.totalDamage>0))return {battle:next,payload:{...payload,selfSacrificed:false},events:[]};
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,selfSacrificed:false},events:[]};
  const applied=applyHpGroup(next,[{actorId:actor.actorId,delta:-actor.hp}],'self-sacrifice');next=applied.battle;
  return {battle:next,payload:{...payload,selfSacrificed:true},events:applied.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id,reason:'selfSacrifice'}))};
 }
};
