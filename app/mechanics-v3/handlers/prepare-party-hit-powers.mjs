import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const preparePartyHitPowersHandler={
 id:'prepare-party-hit-powers',hooks:['onMove'],
 run({battle,payload,params={},runtime={}}){
  const next=clone(battle),{action,move}=payload,actor=unitById(next,action.actorId),species=runtime.species;
  if(!actor||actor.hp<=0)return {battle:next,payload:{...payload,partyHitPowers:[]},events:[{kind:'moveFailed',actorId:action.actorId,moveId:move.id,reason:'actorUnavailable'}]};
  if(!species)throw new Error('prepare-party-hit-powers requires species catalog');
  const roster=next.sides?.[action.side]?.roster||[],powers=[];
  for(const member of roster){if(!member||member.hp<=0||member.status)continue;const entry=Array.isArray(species)?species.find(value=>value.id===member.speciesId):species[member.speciesId],baseAtk=entry?.baseStats?.atk;if(!Number.isFinite(baseAtk))throw new Error(`missing base Attack for Beat Up participant: ${member.speciesId}`);powers.push((params.basePower??5)+Math.floor(baseAtk/(params.attackDivisor??10)));}
  if(!powers.length)return {battle:next,payload:{...payload,cancelled:true,partyHitPowers:[]},events:[{kind:'moveFailed',actorId:actor.actorId,moveId:move.id,reason:'noEligiblePartyMember'}]};
  return {battle:next,payload:{...payload,partyHitPowers:powers},events:[{kind:'partyHitPowersPrepared',actorId:actor.actorId,moveId:move.id,hitCount:powers.length,powers:[...powers]}]};
 }
};
