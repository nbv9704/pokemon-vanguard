import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {abilityPreventsIndirectDamage} from './ability-hooks.mjs';

const maxHp=unit=>unit?.maxHp??unit?.stats?.hp;
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export function prepareBindingResidualEndTurn(battle){
 const next=clone(battle),changes=[],events=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const state=unit.volatiles?.bound;if(!state)continue;
  const source=unitById(next,state.sourceActorId),sourceSide=sideOf(next,state.sourceActorId),sourceActive=source&&source.hp>0&&sourceSide&&(next.sides?.[sourceSide]?.active||[]).includes(source.actorId);
  if(!sourceActive){delete unit.volatiles.bound;events.push({kind:'volatileEnded',actorId:unit.actorId,volatile:'bound',sourceMoveId:state.sourceId,reason:'sourceUnavailable'});continue;}
  if(abilityPreventsIndirectDamage(unit))continue;
  const numerator=state.residualNumerator??1,denominator=state.residualDenominator??8,amount=Math.max(1,Math.floor(maxHp(unit)*numerator/denominator));changes.push({actorId:unit.actorId,delta:-amount});
 }
 return {battle:next,group:{id:'binding-residual',changes},events};
}
