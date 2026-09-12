import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {baseDamage} from '../rules-v3/damage.mjs';
import {stagedStat} from '../rules-v3/stats.mjs';

function confusionDamage(unit,runtime,level){
 const attack=stagedStat(unit.stats.atk,unit.stages?.atk||0),defense=stagedStat(unit.stats.def,unit.stages?.def||0);
 const randomRoll=85+Math.floor(runtime.nextRandom()*16),base=baseDamage({level,power:40,attack,defense});
 return {damage:Math.max(1,Math.floor(base*randomRoll/100)),base,randomRoll,attack,defense};
}

export function tryFlinchAction(battle,action){
 const next=clone(battle),unit=unitById(next,action.actorId),volatiles=unit?.volatiles||{};
 if(!volatiles.flinch)return {cancelled:false,battle:next,events:[]};
 delete volatiles.flinch;
 return {cancelled:true,battle:next,events:[{kind:'volatileActivated',actorId:action.actorId,volatile:'flinch'},{kind:'actionPrevented',actorId:action.actorId,status:'flinch'},{kind:'volatileEnded',actorId:action.actorId,volatile:'flinch',reason:'consumed'}]};
}

export function tryConfusionAction(battle,action,runtime={}){
 const next=clone(battle),unit=unitById(next,action.actorId),volatiles=unit?.volatiles||{};
 if(!volatiles.confusion)return {cancelled:false,battle:next,events:[]};
 volatiles.confusion.timer--;
 if(volatiles.confusion.timer<=0){delete volatiles.confusion;return {cancelled:false,battle:next,events:[{kind:'volatileEnded',actorId:action.actorId,volatile:'confusion',reason:'naturalRecovery'}]};}
 if(typeof runtime.nextRandom!=='function')throw new Error('confusion action gate requires seeded nextRandom');
 const events=[{kind:'volatileActivated',actorId:action.actorId,volatile:'confusion',timer:volatiles.confusion.timer}];
 if(runtime.nextRandom()>=.33)return {cancelled:false,battle:next,events};
 const breakdown=confusionDamage(unit,runtime,next.level||50),hpBefore=unit.hp,amount=Math.min(hpBefore,breakdown.damage);unit.hp-=amount;
 events.push({kind:'damage',actorId:action.actorId,targetId:action.actorId,moveId:'confusion',hpBefore,hpAfter:unit.hp,amount,breakdown});
 if(unit.hp===0)events.push({kind:'fainted',targetId:action.actorId,source:'confusion'});
 events.push({kind:'actionPrevented',actorId:action.actorId,status:'confusion'});
 return {cancelled:true,battle:next,events};
}

export function tryVolatileAction(battle,action,runtime={}){
 const flinch=tryFlinchAction(battle,action);if(flinch.cancelled)return flinch;
 const confusion=tryConfusionAction(flinch.battle,action,runtime);
 return {cancelled:confusion.cancelled,battle:confusion.battle,events:[...flinch.events,...confusion.events]};
}
