import {activeUnits,otherSide} from './battle-state.mjs';
import {selectRedirection} from './redirection.mjs';

export const TARGET_MODES=['self','adjacentAlly','adjacentFoe','anyAdjacent','allAdjacentFoes','allAdjacent','userSide','foeSide','field'];
const targetRefs=(battle,side)=>activeUnits(battle,side).map(({unit,...target})=>target);

export function legalTargets(battle,{side,actorId,targetMode}){
 if(!TARGET_MODES.includes(targetMode))throw new Error(`unknown target mode: ${targetMode}`);
 const allies=targetRefs(battle,side),foes=targetRefs(battle,otherSide(side)),self=allies.find(entry=>entry.actorId===actorId);
 if(!self)throw new Error('actor is not active');
 if(targetMode==='self')return [self];
 if(targetMode==='adjacentAlly')return allies.filter(entry=>entry.actorId!==actorId);
 if(targetMode==='adjacentFoe')return foes;
 if(targetMode==='anyAdjacent')return [...allies.filter(entry=>entry.actorId!==actorId),...foes];
 if(targetMode==='allAdjacentFoes')return foes;
 if(targetMode==='allAdjacent')return [...allies.filter(entry=>entry.actorId!==actorId),...foes];
 if(targetMode==='userSide')return [{scope:'side',side}];
 if(targetMode==='foeSide')return [{scope:'side',side:otherSide(side)}];
 return [{scope:'field'}];
}

export function resolveTargets(battle,request,{redirectable=true}={}){
 const targets=legalTargets(battle,request);
 if(['self','allAdjacentFoes','allAdjacent','userSide','foeSide','field'].includes(request.targetMode))return targets;
 const selected=targets.find(entry=>entry.side===request.target?.side&&entry.slot===request.target?.slot);
 if(!selected)return [];
 const redirected=redirectable?selectRedirection(battle,{...request,selected}):null;
 return [redirected||selected];
}
