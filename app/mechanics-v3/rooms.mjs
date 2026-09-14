import {clone,unitById} from '../rules-v3/battle-state.mjs';

export const ROOM_IDS=['trick-room','wonder-room','magic-room'];

export function roomState(battle,room){return battle?.field?.rooms?.[room]||null;}
export function roomActive(battle,room){return !!roomState(battle,room);}

export function applyRoom(battle,{actorId,moveId,room,defaultTurns=5}){
 if(!ROOM_IDS.includes(room))throw new Error(`unsupported room: ${room}`);
 if(!Number.isInteger(defaultTurns)||defaultTurns<1)throw new Error('room duration must be a positive integer');
 const next=clone(battle),actor=unitById(next,actorId);
 if(!actor||actor.hp<=0)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 next.field??={};next.field.rooms??={};
 if(next.field.rooms[room]){
  delete next.field.rooms[room];
  if(!Object.keys(next.field.rooms).length)delete next.field.rooms;
  return {battle:next,applied:false,toggledOff:true,events:[{kind:'roomEnded',actorId,moveId,room,reason:'recast'}]};
 }
 next.field.rooms[room]={id:room,remaining:defaultTurns,sourceActorId:actorId,sourceMoveId:moveId};
 return {battle:next,applied:true,toggledOff:false,events:[{kind:'roomStarted',actorId,moveId,room,remaining:defaultTurns}]};
}

export function wonderRoomDefenseBase(battle,unit,defenseKey){
 if(!roomActive(battle,'wonder-room'))return unit?.stats?.[defenseKey];
 if(defenseKey==='def')return unit?.stats?.spd;
 if(defenseKey==='spd')return unit?.stats?.def;
 return unit?.stats?.[defenseKey];
}
