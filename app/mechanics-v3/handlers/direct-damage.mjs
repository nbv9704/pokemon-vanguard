import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {calculateDamage} from '../../rules-v3/damage.mjs';
import {resolveTargets} from '../../rules-v3/targets.mjs';
import {typeEffectiveness} from '../../rules-v3/type-chart.mjs';

export const directDamageHandler={
 id:'deal-direct-damage',hooks:['onMove'],
 run({battle,payload,runtime}){
  if(typeof runtime.nextRandom!=='function')throw new Error('deal-direct-damage requires seeded nextRandom');
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId),events=[];
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  const targets=payload.accuracyResolved
   ?(payload.hitTargetIds||[]).map(actorId=>({actorId}))
   :resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false});
  if(payload.accuracyResolved&&!payload.resolvedTargetIds?.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(payload.accuracyResolved&&!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[]};
  if(!targets.length)return {battle:next,payload:{...payload,totalDamage:0,targetIds:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'noTarget'}]};
  let totalDamage=0;
  for(const targetRef of targets){
   const defender=unitById(next,targetRef.actorId);if(!defender||defender.hp<=0)continue;
   const effectiveness=typeEffectiveness(move.type,defender.types),physical=move.category==='physical';
   if(effectiveness===0){
    const breakdown=calculateDamage({level:next.level||50,power:move.power,attack:actor.stats[physical?'atk':'spa'],defense:defender.stats[physical?'def':'spd'],moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll:100,physical});
    events.push({kind:'damage',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id,hpBefore:defender.hp,hpAfter:defender.hp,amount:0,effectiveness,breakdown:{...breakdown,randomApplied:false}});continue;
   }
   if(!payload.accuracyResolved&&move.accuracy!==null&&move.accuracy<100&&runtime.nextRandom()>=move.accuracy/100){events.push({kind:'moveMissed',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id});continue;}
   const critical=runtime.nextRandom()<1/24,randomRoll=85+Math.floor(runtime.nextRandom()*16);
   const damage=calculateDamage({level:next.level||50,power:move.power,attack:actor.stats[physical?'atk':'spa'],defense:defender.stats[physical?'def':'spd'],moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll,spread:mechanics.targetMode==='allAdjacentFoes'&&(payload.resolvedTargetIds?.length||targets.length)>1,critical,burned:(actor.status?.id||actor.status)==='burn',physical});
   const hpBefore=defender.hp,amount=Math.min(hpBefore,damage.damage);defender.hp-=amount;totalDamage+=amount;
   events.push({kind:'damage',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id,hpBefore,hpAfter:defender.hp,amount,effectiveness:damage.type,breakdown:damage});
   if(defender.hp===0)events.push({kind:'fainted',targetId:defender.actorId,source:move.id});
  }
  return {battle:next,payload:{...payload,totalDamage,targetIds:targets.map(target=>target.actorId)},events};
 }
};
