import {clone,unitById} from '../../rules-v3/battle-state.mjs';

const supported=new Set(['trapped','ingrain','aqua-ring','salt-cure','magnet-rise']);

export const applyPersistentEffectHandler={
 id:'apply-persistent-effect',hooks:['onMove'],
 run({battle,payload,params}){
  if(!supported.has(params.effect))throw new Error(`unsupported persistent effect: ${params.effect}`);
  let next=clone(battle);const {action,move}=payload,events=[],appliedTargetIds=[];
  const baseTargets=params.target==='self'?[action.actorId]:(params.requireDamage===true?(payload.damagedTargetIds||[]):(payload.hitTargetIds||[]));
  const applications=[...baseTargets.map(targetId=>({sourceId:action.actorId,targetId,reflected:false})),...(params.target==='self'?[]:(payload.reflectedStatusHits||[]).map(hit=>({sourceId:hit.sourceId,targetId:hit.targetId,reflected:true})))];
  for(const application of applications){
   const source=unitById(next,application.sourceId),target=unitById(next,application.targetId);if(!source||source.hp<=0||!target||target.hp<=0)continue;
   target.volatiles??={};const existing=target.volatiles[params.effect];
   if(existing){events.push({kind:'volatileFailed',actorId:source.actorId,targetId:target.actorId,moveId:move.id,volatile:params.effect,reason:'alreadyVolatile',reflected:application.reflected});continue;}
   const state={id:params.effect,sourceId:move.id,sourceActorId:source.actorId};if(Number.isInteger(params.turns))state.endTurnTimer=params.turns;
   if(params.effect==='trapped')state.trapsSwitch=true;
   target.volatiles[params.effect]=state;appliedTargetIds.push(target.actorId);
   events.push({kind:'volatileApplied',actorId:source.actorId,targetId:target.actorId,moveId:move.id,volatile:params.effect,...(state.endTurnTimer?{turns:state.endTurnTimer}:{}),reflected:application.reflected});
  }
  return {battle:next,payload:{...payload,persistentEffectTargetIds:[...new Set(appliedTargetIds)]},events};
 }
};
