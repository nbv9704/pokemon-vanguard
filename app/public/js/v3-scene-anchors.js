const SINGLE={own:[{x:22,y:76}],enemy:[{x:78,y:25}]};
const DOUBLE={own:[{x:18,y:77},{x:43,y:69}],enemy:[{x:82,y:23},{x:58,y:32}]};
const FIELD={x:50,y:50};

function sideAndSlot(snapshot,actorId){
 for(const [side,list] of [['own',snapshot.own||[]],['enemy',snapshot.opponent||[]]]){const mon=list.find(entry=>entry.actorId===actorId);if(mon)return {side,slot:Math.max(0,mon.activeSlot||0)};}
 return null;
}

export function sceneAnchor(snapshot,actorId,{oppositeOf}={}){
 if(actorId==='field')return {...FIELD,side:'field',slot:-1};
 const found=sideAndSlot(snapshot,actorId),format=snapshot.format==='double'?'double':'single',table=format==='double'?DOUBLE:SINGLE;
 if(found){const point=table[found.side][Math.min(found.slot,table[found.side].length-1)]||table[found.side][0];return {...point,...found};}
 const origin=sideAndSlot(snapshot,oppositeOf),side=origin?.side==='enemy'?'own':'enemy',slot=Math.min(origin?.slot||0,table[side].length-1),point=table[side][slot];return {...point,side,slot};
}

export function sceneTracks(snapshot,actorId,targetIds=[]){
 const start=sceneAnchor(snapshot,actorId),ids=targetIds.length?targetIds:[String(actorId).startsWith('B-')?'A-0':'B-0'];
 return ids.map(targetId=>({targetId,start,end:sceneAnchor(snapshot,targetId,{oppositeOf:actorId})}));
}

export function sceneTrackStyle(track){return `--start-x:${track.start.x}%;--start-y:${track.start.y}%;--end-x:${track.end.x}%;--end-y:${track.end.y}%`;}
