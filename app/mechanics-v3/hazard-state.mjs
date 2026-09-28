import {clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {HAZARD_IDS} from './manifest-contract.mjs';

const MAX_LAYERS={'stealth-rock':1,spikes:3,'toxic-spikes':2,'sticky-web':1};
const sideOf=(battle,actorId)=>['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;

export function applyHazard(battle,{actorId,moveId,hazard,allowFainted=false}){
 if(!HAZARD_IDS.includes(hazard))throw new Error(`unsupported hazard: ${hazard}`);
 const next=clone(battle),sourceSide=sideOf(next,actorId),actor=unitById(next,actorId);
 if(!sourceSide||!actor||(!allowFainted&&actor.hp<=0))return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 const side=otherSide(sourceSide);next.sides[side].conditions??={};
 const existing=next.sides[side].conditions[hazard],maxLayers=MAX_LAYERS[hazard];
 if(existing?.layers>=maxLayers)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'hazardMaxLayers',hazard,layers:existing.layers,maxLayers,side}]};
 if(existing){existing.layers++;existing.sourceActorId=existing.sourceActorId||actorId;existing.sourceMoveId=existing.sourceMoveId||moveId;}
 else{
  next.hazardSequence=(next.hazardSequence||0)+1;
  next.sides[side].conditions[hazard]={id:hazard,layers:1,sourceActorId:actorId,sourceMoveId:moveId,order:next.hazardSequence};
 }
 const state=next.sides[side].conditions[hazard];
 return {battle:next,applied:true,events:[{kind:'hazardApplied',actorId,moveId,side,hazard,layers:state.layers,maxLayers}]};
}
