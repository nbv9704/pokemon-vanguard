import {nextRandom} from './rng.mjs';

const ACTION_RANK={replace:3,switch:2,move:1};

export function compareTurnActions(left,right,{trickRoom=false}={}){
 const rank=(ACTION_RANK[right.kind]??0)-(ACTION_RANK[left.kind]??0);if(rank)return rank;
 const priority=(right.priority??0)-(left.priority??0);if(priority)return priority;
 const orderBoost=(right.orderBoost??0)-(left.orderBoost??0);if(orderBoost)return orderBoost;
 const speed=trickRoom?(left.speed??0)-(right.speed??0):(right.speed??0)-(left.speed??0);if(speed)return speed;
 const tie=(right.tieKey??0)-(left.tieKey??0);if(tie)return tie;
 return String(left.actorId).localeCompare(String(right.actorId));
}

export function orderTurnActions(actions,options){return [...actions].sort((left,right)=>compareTurnActions(left,right,options));}

export function prepareTurnActions(actions,rngState){
 const stable=[...actions].sort((left,right)=>String(left.actorId).localeCompare(String(right.actorId)));
 const prepared=[];let state=rngState;
 for(const action of stable){const roll=nextRandom(state);state=roll.rngState;prepared.push({...action,tieKey:roll.value});}
 return {actions:prepared,rngState:state};
}

export function buildTurnQueue(actions,rngState,options){
 const prepared=prepareTurnActions(actions,rngState);
 return {actions:orderTurnActions(prepared.actions,options),rngState:prepared.rngState};
}
