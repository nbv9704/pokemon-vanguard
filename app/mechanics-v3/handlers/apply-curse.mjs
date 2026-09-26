import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../../rules-v3/lifecycle.mjs';
import {resolveTargets} from '../targets.mjs';
import {resolveTargetAbilityBlock} from '../ability-hooks.mjs';
import {applyStatStagesHandler} from './apply-stat-stages.mjs';

export const applyCurseHandler={
 id:'apply-curse',hooks:['onMove'],
 run({battle,payload,runtime}){
  const {action,move,mechanics}=payload,actor=unitById(battle,action.actorId);if(!actor||actor.hp<=0)return {battle:clone(battle),payload,events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(!(actor.types||[]).includes('ghost'))return applyStatStagesHandler.run({battle,payload,params:{target:'self',boosts:{atk:1,def:1,spe:-1}},runtime});
  let next=clone(battle),events=[];const targets=resolveTargets(next,{side:action.side,actorId:actor.actorId,targetMode:mechanics.targetMode,target:action.target},{redirectable:mechanics.redirectable!==false,move});
  const target=targets[0]&&unitById(next,targets[0].actorId);if(!target||target.hp<=0)return {battle:next,payload,events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noTarget'}]};
  const abilityBlock=resolveTargetAbilityBlock(next,{actorId:actor.actorId,targetId:target.actorId,move,mechanics});if(abilityBlock?.blocked)return {battle:abilityBlock.battle,payload,events:abilityBlock.events};
  target.volatiles??={};if(target.volatiles.curse)return {battle:next,payload,events:[{kind:'volatileFailed',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,volatile:'curse',reason:'alreadyVolatile'}]};
  target.volatiles.curse={id:'curse',sourceId:move.id,sourceActorId:actor.actorId};events.push({kind:'volatileApplied',actorId:actor.actorId,targetId:target.actorId,moveId:move.id,volatile:'curse'});
  const maxHp=actor.maxHp??actor.stats?.hp,cost=Math.max(1,Math.floor(maxHp/2)),paid=applyHpGroup(next,[{actorId:actor.actorId,delta:-cost}],`move:${move.id}:self-damage`);next=paid.battle;events.push(...paid.events.map(event=>({...event,actorId:actor.actorId,moveId:move.id,selfDamage:true})));
  return {battle:next,payload:{...payload,curseTargetIds:[target.actorId],selfHpDamage:paid.events.find(event=>event.kind==='damage')?.amount||0},events};
 }
};
