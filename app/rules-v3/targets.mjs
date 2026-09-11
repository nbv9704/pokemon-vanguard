export const TARGET_MODES=['self','adjacentAlly','adjacentFoe','anyAdjacent','allAdjacentFoes','allAdjacent','userSide','foeSide','field'];
const otherSide=side=>side==='A'?'B':'A';
const active=(battle,side)=>(battle.sides?.[side]?.active||[]).map((actorId,slot)=>({side,slot,actorId})).filter(entry=>entry.actorId!==null&&entry.actorId!==undefined);

export function legalTargets(battle,{side,actorId,targetMode}){
 if(!TARGET_MODES.includes(targetMode))throw new Error(`unknown target mode: ${targetMode}`);
 const allies=active(battle,side),foes=active(battle,otherSide(side)),self=allies.find(entry=>entry.actorId===actorId);
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

export function resolveTargets(battle,request){
 const targets=legalTargets(battle,request);
 if(['self','allAdjacentFoes','allAdjacent','userSide','foeSide','field'].includes(request.targetMode))return targets;
 const selected=targets.find(entry=>entry.side===request.target?.side&&entry.slot===request.target?.slot);
 return selected?[selected]:[];
}
