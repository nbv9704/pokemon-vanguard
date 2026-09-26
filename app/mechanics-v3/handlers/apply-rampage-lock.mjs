import {activeUnits,clone,otherSide,unitById} from '../../rules-v3/battle-state.mjs';
import {applyVolatileStatus} from '../volatile-state.mjs';

function randomFoeTarget(battle,side,runtime){
 const foes=activeUnits(battle,otherSide(side)).filter(({unit})=>unit.hp>0);if(!foes.length)return null;if(typeof runtime?.nextRandom!=='function')throw new Error('apply-rampage-lock requires seeded nextRandom');return foes[Math.min(foes.length-1,Math.floor(runtime.nextRandom()*foes.length))];
}

export const applyRampageLockHandler={
 id:'apply-rampage-lock',hooks:['onTryMove','onMove'],
 run({battle,payload,params={},runtime}){
  let next=clone(battle);const actor=unitById(next,payload.action.actorId),events=[];if(!actor||actor.hp<=0)return {battle:next,payload,events};
  // onTryMove is the only invocation before accuracy/damage and has no damage result fields yet.
  if(payload.totalDamage===undefined&&payload.accuracyResolved===undefined){const chosen=randomFoeTarget(next,payload.action.side,runtime);if(!chosen)return {battle:next,payload,events};return {battle:next,payload:{...payload,action:{...payload.action,target:{side:chosen.side,slot:chosen.slot}}},events:[{kind:'rampageTargetChosen',actorId:actor.actorId,moveId:payload.move.id,targetId:chosen.unit.actorId}]};}
  actor.volatiles??={};const existing=actor.volatiles.rampage,connected=(payload.connectedTargetIds||[]).length>0;
  if(existing?.moveId===payload.move.id){
   const finalTurn=(existing.remaining||1)<=1;
   if(!connected&&!finalTurn){delete actor.volatiles.rampage;events.push({kind:existing.blocksSleep?'uproarEnded':'rampageEnded',actorId:actor.actorId,moveId:payload.move.id,reason:'interrupted'});return {battle:next,payload,events};}
   existing.remaining=Math.max(0,(existing.remaining||1)-1);events.push({kind:'rampageAdvanced',actorId:actor.actorId,moveId:payload.move.id,remaining:existing.remaining});if(existing.blocksSleep){for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){if((unit.status?.id||unit.status)==='sleep'){unit.status=null;events.push({kind:'statusCured',actorId:actor.actorId,targetId:unit.actorId,status:'sleep',reason:'uproar',moveId:payload.move.id});}}}
   if(existing.remaining<=0){delete actor.volatiles.rampage;events.push({kind:existing.blocksSleep?'uproarEnded':'rampageEnded',actorId:actor.actorId,moveId:payload.move.id,reason:'completed'});if(existing.confuseOnEnd!==false){const confused=applyVolatileStatus(next,{actorId:actor.actorId,targetId:actor.actorId,moveId:payload.move.id,volatile:'confusion'},runtime);next=confused.battle;events.push(...confused.events);}}
   return {battle:next,payload,events};
  }
  if(!connected)return {battle:next,payload,events};
  const totalTurns=Number.isInteger(params.turns)?params.turns:(typeof runtime?.nextRandom==='function'?2+Math.floor(runtime.nextRandom()*2):null);if(!Number.isInteger(totalTurns)||totalTurns<1)throw new Error('apply-rampage-lock requires seeded nextRandom or positive turns');actor.volatiles.rampage={id:'rampage',sourceId:payload.move.id,moveId:payload.move.id,remaining:totalTurns-1,totalTurns,confuseOnEnd:params.confuseOnEnd!==false,...(params.blocksSleep===true?{blocksSleep:true}:{})};events.push({kind:params.blocksSleep===true?'uproarStarted':'rampageStarted',actorId:actor.actorId,moveId:payload.move.id,totalTurns,remaining:totalTurns-1});if(params.blocksSleep===true){for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){if((unit.status?.id||unit.status)==='sleep'){unit.status=null;events.push({kind:'statusCured',actorId:actor.actorId,targetId:unit.actorId,status:'sleep',reason:'uproar',moveId:payload.move.id});}}}return {battle:next,payload,events};
 }
};
