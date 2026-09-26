import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {resolveTargets} from '../targets.mjs';
import {stagedStat} from '../../rules-v3/stats.mjs';

export const prepareBestDamageCategoryHandler={
 id:'prepare-best-damage-category',hooks:['onMove'],
 run({battle,payload,runtime}){
  const next=clone(battle),{action,move,mechanics}=payload,actor=unitById(next,action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};const targetRef=resolveTargets(next,{side:action.side,actorId:action.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move})[0],target=targetRef&&unitById(next,targetRef.actorId);if(!target||target.hp<=0)return {battle:next,payload,events:[]};
  const atk=stagedStat(actor.stats.atk,actor.stages?.atk||0),spa=stagedStat(actor.stats.spa,actor.stages?.spa||0),def=Math.max(1,stagedStat(target.stats.def,target.stages?.def||0)),spd=Math.max(1,stagedStat(target.stats.spd,target.stages?.spd||0)),physical=Math.floor(Math.floor(Math.floor(Math.floor(2*(actor.level??next.level??50)/5+2)*move.power*atk)/def)/50),special=Math.floor(Math.floor(Math.floor(Math.floor(2*(actor.level??next.level??50)/5+2)*move.power*spa)/spd)/50);let category='special';if(physical>special)category='physical';else if(physical===special){if(typeof runtime?.nextRandom!=='function')throw new Error('damage category tie requires seeded nextRandom');if(runtime.nextRandom()<.5)category='physical';}
  const nextMove={...move,category},nextMechanics={...mechanics,contact:category==='physical'};return {battle:next,payload:{...payload,move:nextMove,mechanics:nextMechanics},events:[{kind:'moveCategorySelected',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,category,physicalEstimate:physical,specialEstimate:special}]};
 }
};
