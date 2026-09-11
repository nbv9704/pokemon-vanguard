const ACTION_RANK={replace:3,switch:2,move:1};

export function compareTurnActions(left,right,{trickRoom=false}={}){
 const rank=(ACTION_RANK[right.kind]??0)-(ACTION_RANK[left.kind]??0);if(rank)return rank;
 const priority=(right.priority??0)-(left.priority??0);if(priority)return priority;
 const speed=trickRoom?(left.speed??0)-(right.speed??0):(right.speed??0)-(left.speed??0);if(speed)return speed;
 const tie=(right.tieKey??0)-(left.tieKey??0);if(tie)return tie;
 return String(left.actorId).localeCompare(String(right.actorId));
}

export function orderTurnActions(actions,options){return [...actions].sort((left,right)=>compareTurnActions(left,right,options));}
