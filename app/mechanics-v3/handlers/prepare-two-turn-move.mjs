import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {effectiveWeatherId} from '../ability-field.mjs';
import {twoTurnMoveState} from '../move-commitments.mjs';
import {abilityStageChange} from '../ability-stage-change.mjs';

export const prepareTwoTurnMoveHandler={
 id:'prepare-two-turn-move',hooks:['onTryMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),moveId=payload.move.id,state=twoTurnMoveState(actor),remaining=actor?.pp?.[moveId];
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  if(state?.moveId===moveId){const semiInvulnerable=state.semiInvulnerable||null;delete actor.volatiles['two-turn-move'];return {battle:next,payload:{...payload,skipPp:true,twoTurnRelease:true,semiInvulnerable},events:[{kind:'twoTurnMoveReleased',actorId:actor.actorId,moveId,...(semiInvulnerable?{semiInvulnerable}:{})}]};}
  if(!Number.isInteger(remaining)||remaining<=0)return {battle:next,payload,events:[]};
  const events=[];if(params.chargeBoosts&&typeof params.chargeBoosts==='object'){actor.stages??={};for(const [stat,rawDelta] of Object.entries(params.chargeBoosts)){const changed=abilityStageChange(actor,rawDelta),before=Number.isInteger(actor.stages[stat])?actor.stages[stat]:0,after=Math.max(-6,Math.min(6,before+changed.requestedDelta));actor.stages[stat]=after;if(changed.sourceAbilityId)events.push({kind:'abilityTriggered',sourceId:actor.actorId,abilityId:changed.sourceAbilityId,effectId:changed.effectId,trigger:'stat-change'});events.push({kind:'statStageChanged',actorId:actor.actorId,targetId:actor.actorId,moveId,stat,before,after,requestedDelta:changed.requestedDelta,originalRequestedDelta:rawDelta,appliedDelta:after-before,reason:after===before?'stageLimit':null});}}
  const weather=effectiveWeatherId(next),skipWeather=params.sunSkipsCharge===true&&weather==='sun'||Array.isArray(params.skipChargeInWeather)&&params.skipChargeInWeather.includes(weather);if(skipWeather)return {battle:next,payload:{...payload,twoTurnChargeSkipped:true},events:[...events,{kind:'twoTurnChargeSkipped',actorId:actor.actorId,moveId,reason:weather}]};
  const semiInvulnerable=params.kind==='semi-invulnerable'?params.semiInvulnerable:null;actor.volatiles=actor.volatiles||{};actor.volatiles['two-turn-move']={id:'two-turn-move',moveId,target:clone(payload.action.target??null),startedTurn:next.turn,...(semiInvulnerable?{semiInvulnerable}:{})};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true,twoTurnPrepared:true,semiInvulnerable},events:[...events,{kind:'twoTurnMovePrepared',actorId:actor.actorId,moveId,target:clone(payload.action.target??null),...(semiInvulnerable?{semiInvulnerable}:{})}]};
 }
};
