import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {effectiveWeatherId} from '../ability-field.mjs';
import {twoTurnMoveState} from '../move-commitments.mjs';

export const prepareTwoTurnMoveHandler={
 id:'prepare-two-turn-move',hooks:['onTryMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId),moveId=payload.move.id,state=twoTurnMoveState(actor),remaining=actor?.pp?.[moveId];
  if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  if(state?.moveId===moveId){const semiInvulnerable=state.semiInvulnerable||null;delete actor.volatiles['two-turn-move'];return {battle:next,payload:{...payload,skipPp:true,twoTurnRelease:true,semiInvulnerable},events:[{kind:'twoTurnMoveReleased',actorId:actor.actorId,moveId,...(semiInvulnerable?{semiInvulnerable}:{})}]};}
  if(params.sunSkipsCharge===true&&effectiveWeatherId(next)==='sun')return {battle:next,payload:{...payload,twoTurnChargeSkipped:true},events:[{kind:'twoTurnChargeSkipped',actorId:actor.actorId,moveId,reason:'sun'}]};
  if(!Number.isInteger(remaining)||remaining<=0)return {battle:next,payload,events:[]};
  const semiInvulnerable=params.kind==='semi-invulnerable'?params.semiInvulnerable:null;actor.volatiles=actor.volatiles||{};actor.volatiles['two-turn-move']={id:'two-turn-move',moveId,target:clone(payload.action.target??null),startedTurn:next.turn,...(semiInvulnerable?{semiInvulnerable}:{})};
  return {battle:next,payload:{...payload,cancelled:true,recordLastMove:true,twoTurnPrepared:true,semiInvulnerable},events:[{kind:'twoTurnMovePrepared',actorId:actor.actorId,moveId,target:clone(payload.action.target??null),...(semiInvulnerable?{semiInvulnerable}:{})}]};
 }
};
