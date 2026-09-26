import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {activeAbilityId,suppressActiveAbility} from './ability-replacement.mjs';

const PASSABLE_VOLATILES=new Set(['confusion','aqua-ring','curse','dragon-cheer','embargo','focus-energy','heal-block','ingrain','leech-seed','target-lock','magnet-rise','perish-song','substitute','telekinesis']);
const UNSUPPRESSIBLE=new Set(['disguise','forecast','hunger-switch','imposter','mimicry','stance-change','zero-to-hero']);
const stagesOf=unit=>Object.fromEntries(['atk','def','spa','spd','spe','accuracy','evasion'].map(stat=>[stat,Number.isInteger(unit?.stages?.[stat])?unit.stages[stat]:0]));

export function captureBatonPassState(unit){
 const volatiles={};for(const [id,state] of Object.entries(unit?.volatiles||{}))if(PASSABLE_VOLATILES.has(id))volatiles[id]=clone(state);
 return {stages:stagesOf(unit),volatiles,powerTrick:Boolean(unit?.volatiles?.['power-trick']),abilitySuppressed:activeAbilityId(unit)==='none'};
}

export function applyBatonPassState(battle,{sourceId,targetId,state,moveId='baton-pass',manifests=null}={}){
 let next=clone(battle),events=[],incoming=unitById(next,targetId);if(!incoming||!state)return {battle:next,events};
 incoming.stages={...state.stages};incoming.volatiles??={};for(const [id,value] of Object.entries(state.volatiles||{}))incoming.volatiles[id]=clone(value);
 if(state.powerTrick){const atk=incoming.stats?.atk,def=incoming.stats?.def;if(Number.isInteger(atk)&&Number.isInteger(def)){incoming.volatiles['stored-stat-overrides']={id:'stored-stat-overrides',originalStats:{atk,def}};incoming.volatiles['power-trick']={id:'power-trick'};incoming.stats.atk=def;incoming.stats.def=atk;}}
 if(state.abilitySuppressed&&!UNSUPPRESSIBLE.has(activeAbilityId(incoming))){const suppressed=suppressActiveAbility(next,{actorId:incoming.actorId,sourceId,reason:`move:${moveId}:baton-pass`});next=suppressed.battle;events.push(...suppressed.events);incoming=unitById(next,targetId);}
 events.push({kind:'batonPassTransferred',actorId:sourceId,targetId:incoming.actorId,moveId,stages:{...state.stages},volatiles:Object.keys(state.volatiles||{}).sort(),powerTrick:state.powerTrick===true,abilitySuppressed:activeAbilityId(incoming)==='none'});
 return {battle:next,events};
}

export function applyShedTailTransfer(battle,{sourceId,targetId,subHp,moveId='shed-tail'}={}){
 const next=clone(battle),incoming=unitById(next,targetId);if(!incoming||!Number.isInteger(subHp)||subHp<1)return {battle:next,events:[]};
 incoming.volatiles??={};incoming.volatiles.substitute={id:'substitute',hp:subHp,maxHp:subHp,sourceId:moveId,transferred:true};
 return {battle:next,events:[{kind:'substituteCreated',actorId:incoming.actorId,sourceActorId:sourceId,moveId,hp:subHp,transferred:true}]};
}
