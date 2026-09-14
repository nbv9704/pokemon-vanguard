import {clone,otherSide,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup} from '../rules-v3/lifecycle.mjs';
import {typeEffectiveness} from '../rules-v3/type-chart.mjs';
import {HAZARD_IDS} from './manifest-contract.mjs';
import {applyMajorStatus} from './major-status.mjs';
import {unitIsGrounded} from './terrain.mjs';
import {resolveHpThresholdItems} from './item-hooks.mjs';
const MAX_LAYERS={'stealth-rock':1,spikes:3,'toxic-spikes':2};
const maxHp=unit=>unit.maxHp??unit.stats?.hp;

function sideOf(battle,actorId){return ['A','B'].find(side=>battle.sides?.[side]?.roster?.some(unit=>unit.actorId===actorId))||null;}

export function applyHazard(battle,{actorId,moveId,hazard}){
 if(!HAZARD_IDS.includes(hazard))throw new Error(`unsupported hazard: ${hazard}`);
 const next=clone(battle),sourceSide=sideOf(next,actorId),actor=unitById(next,actorId);
 if(!sourceSide||!actor||actor.hp<=0)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
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

function hazardDamage(unit,hazard,layers){
 const limit=maxHp(unit);
 if(hazard==='stealth-rock')return {amount:Math.max(1,Math.floor(limit*typeEffectiveness('rock',unit.types)/8)),effectiveness:typeEffectiveness('rock',unit.types)};
 if(hazard==='spikes'){
  if(!unitIsGrounded(unit))return {amount:0,effectiveness:1};
  const fractions={1:[1,8],2:[1,6],3:[1,4]},[numerator,denominator]=fractions[layers]||fractions[3];
  return {amount:Math.max(1,Math.floor(limit*numerator/denominator)),effectiveness:1};
 }
 throw new Error(`unsupported damaging hazard: ${hazard}`);
}

function resolveToxicSpikes(next,unit,state,entry,events){
 if(!unitIsGrounded(unit))return next;
 if((unit.types||[]).includes('poison')){
  delete next.sides[entry.side].conditions['toxic-spikes'];
  events.push({kind:'hazardRemoved',actorId:unit.actorId,targetId:unit.actorId,side:entry.side,hazard:'toxic-spikes',layers:state.layers||1,reason:'poison-type-absorption'});
  return next;
 }
 const status=(state.layers||1)>=2?'bad-poison':'poison';
 events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:'toxic-spikes',layers:state.layers||1,status});
 const applied=applyMajorStatus(next,{actorId:state.sourceActorId,targetId:unit.actorId,moveId:state.sourceMoveId||'toxic-spikes',status});
 events.push(...applied.events.map(event=>({...event,hazard:'toxic-spikes',layers:state.layers||1})));
 return applied.battle;
}

export function resolveEntryHazards(battle,switchEvents=[]){
 let next=clone(battle);const events=[];
 for(const entry of switchEvents||[]){
  if(entry?.kind!=='switchIn'||!entry.actorId||!entry.side)continue;
  const entrant=unitById(next,entry.actorId);if(!entrant||entrant.hp<=0)continue;
  const hazards=Object.values(next.sides?.[entry.side]?.conditions||{}).filter(state=>HAZARD_IDS.includes(state?.id)).sort((a,b)=>(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
  for(const state of hazards){
   const unit=unitById(next,entry.actorId);if(!unit||unit.hp<=0)break;
   if(state.id==='toxic-spikes'){next=resolveToxicSpikes(next,unit,state,entry,events);continue;}
   const {amount,effectiveness}=hazardDamage(unit,state.id,state.layers||1);if(amount<=0)continue;
   events.push({kind:'hazardTriggered',targetId:unit.actorId,side:entry.side,hazard:state.id,layers:state.layers||1,amount,effectiveness});
   const applied=applyHpGroup(next,[{actorId:unit.actorId,delta:-amount}],state.id);next=applied.battle;
   events.push(...applied.events.map(event=>({...event,hazard:state.id,layers:state.layers||1,effectiveness:event.kind==='damage'?effectiveness:event.effectiveness})));
   const threshold=resolveHpThresholdItems(next,{actorIds:[unit.actorId],trigger:`hazard:${state.id}`});next=threshold.battle;events.push(...threshold.events);
  }
  const threshold=resolveHpThresholdItems(next,{actorIds:[entry.actorId],trigger:'switch-in'});next=threshold.battle;events.push(...threshold.events);
 }
 return {battle:next,events};
}
