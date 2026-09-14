import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {HAZARD_IDS} from './manifest-contract.mjs';
import {actorSide} from './side-conditions.mjs';

const SCREEN_IDS=['reflect','light-screen'];
const HAZARD_CLEAR_ORDER=['spikes','toxic-spikes','stealth-rock'].filter(id=>HAZARD_IDS.includes(id));

function removeHazard(next,side,hazard,{actorId,moveId,reason},events){
 const state=next.sides?.[side]?.conditions?.[hazard];
 if(!state)return false;
 delete next.sides[side].conditions[hazard];
 events.push({kind:'hazardRemoved',actorId,moveId,side,hazard,layers:state.layers||1,reason});
 return true;
}

function removeHazards(next,side,context,events){
 let removed=false;
 for(const hazard of HAZARD_CLEAR_ORDER)removed=removeHazard(next,side,hazard,context,events)||removed;
 return removed;
}

function removeTargetScreens(next,side,{actorId,moveId,reason},events){
 let removed=false;
 for(const condition of SCREEN_IDS){
  if(!next.sides?.[side]?.conditions?.[condition])continue;
  delete next.sides[side].conditions[condition];
  events.push({kind:'sideConditionEnded',actorId,moveId,side,condition,reason});
  removed=true;
 }
 return removed;
}

export function resolveRapidSpinCleanup(battle,{actorId,moveId,totalDamage=0}){
 const next=clone(battle),actor=unitById(next,actorId),side=actorSide(next,actorId),events=[];
 if(!actor||!side||actor.hp<=0||!(totalDamage>0))return {battle:next,applied:false,events};
 let applied=false;
 if(actor.volatiles?.['leech-seed']){
  delete actor.volatiles['leech-seed'];
  events.push({kind:'volatileEnded',actorId,volatile:'leech-seed',reason:'rapid-spin',moveId});
  applied=true;
 }
 applied=removeHazards(next,side,{actorId,moveId,reason:'rapid-spin'},events)||applied;
 return {battle:next,applied,events};
}

export function resolveDefogCleanup(battle,{actorId,moveId,targetIds=[]}){
 const next=clone(battle),sourceSide=actorSide(next,actorId),target=unitById(next,targetIds[0]),targetSide=target&&actorSide(next,target.actorId),events=[];
 if(!sourceSide||!target||!targetSide||target.hp<=0)return {battle:next,applied:false,events};
 let applied=removeTargetScreens(next,targetSide,{actorId,moveId,reason:'defog'},events);
 applied=removeHazards(next,targetSide,{actorId,moveId,reason:'defog'},events)||applied;
 if(sourceSide!==targetSide)applied=removeHazards(next,sourceSide,{actorId,moveId,reason:'defog'},events)||applied;
 if(next.field?.terrain){
  const terrain=next.field.terrain.id;
  delete next.field.terrain;
  events.push({kind:'terrainEnded',actorId,moveId,terrain,reason:'defog'});
  applied=true;
 }
 return {battle:next,applied,events};
}
