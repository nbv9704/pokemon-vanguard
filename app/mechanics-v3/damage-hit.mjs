import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {calculateDamage} from '../rules-v3/damage.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {stagedStat} from '../rules-v3/stats.mjs';

export function applyDamageHit(battle,{actorId,targetId,move,spread=false,hit=null},runtime){
 if(typeof runtime?.nextRandom!=='function')throw new Error('damage hit requires seeded nextRandom');
 const next=clone(battle),actor=unitById(next,actorId),defender=unitById(next,targetId);
 if(!actor||actor.hp<=0||!defender||defender.hp<=0)return {battle:next,amount:0,events:[]};
 const physical=move.category==='physical',effectiveness=typeEffectiveness(move.type,defender.types);
 if(effectiveness===0){
  const breakdown=calculateDamage({level:next.level||50,power:move.power,attack:actor.stats[physical?'atk':'spa'],defense:defender.stats[physical?'def':'spd'],moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll:100,physical});
  return {battle:next,amount:0,events:[damageEvent(actor,defender,move,0,effectiveness,{...breakdown,randomApplied:false},hit)]};
 }
 const critical=runtime.nextRandom()<1/24,randomRoll=85+Math.floor(runtime.nextRandom()*16),attackKey=physical?'atk':'spa',defenseKey=physical?'def':'spd';
 const attackStage=critical&&actor.stages?.[attackKey]<0?0:actor.stages?.[attackKey]||0,defenseStage=critical&&defender.stages?.[defenseKey]>0?0:defender.stages?.[defenseKey]||0;
 const damage=calculateDamage({level:next.level||50,power:move.power,attack:stagedStat(actor.stats[attackKey],attackStage),defense:stagedStat(defender.stats[defenseKey],defenseStage),moveType:move.type,attackerTypes:actor.types,defenderTypes:defender.types,randomRoll,spread,critical,burned:(actor.status?.id||actor.status)==='burn',physical});
 const hpBefore=defender.hp,amount=Math.min(hpBefore,damage.damage);defender.hp-=amount;
 const events=[damageEvent(actor,{...defender,hp:hpBefore},move,amount,damage.type,damage,hit,defender.hp)];
 if(defender.hp===0)events.push({kind:'fainted',targetId:defender.actorId,source:move.id});
 return {battle:next,amount,events};
}

function damageEvent(actor,defender,move,amount,effectiveness,breakdown,hit,hpAfter=defender.hp){
 return {kind:'damage',actorId:actor.actorId,targetId:defender.actorId,moveId:move.id,hpBefore:defender.hp,hpAfter,amount,effectiveness,breakdown,...(hit===null?{}:{hit})};
}
