import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';

export function applyRedirection(battle,{side,actorId,moveId,kind}){
 const next=clone(battle),actor=unitById(next,actorId),allies=activeUnits(next,side);
 if(!actor||actor.hp<=0)return {battle:next,succeeded:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 if(allies.length<2)return {battle:next,succeeded:false,events:[{kind:'moveFailed',actorId,moveId,reason:'requiresMultipleActive'}]};
 const order=1+Math.max(0,...allies.map(entry=>entry.unit.volatiles?.redirection?.order||0));actor.volatiles??={};
 actor.volatiles.redirection={id:'redirection',kind,sourceId:moveId,active:true,order};
 return {battle:next,succeeded:true,events:[{kind:'redirectionApplied',actorId,moveId,redirection:kind,order}]};
}
