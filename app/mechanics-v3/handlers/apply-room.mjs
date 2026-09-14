import {applyRoom} from '../rooms.mjs';
import {resolveStatusCureItems} from '../item-hooks.mjs';

export const applyRoomHandler={
 id:'apply-room',hooks:['onMove'],
 run({battle,payload,params}){const result=applyRoom(battle,{actorId:payload.action.actorId,moveId:payload.move.id,room:params.room,defaultTurns:params.turns||5}),cured=params.room==='magic-room'&&result.toggledOff?resolveStatusCureItems(result.battle,{trigger:'magic-room-ended'}):{battle:result.battle,events:[]};return {battle:cured.battle,payload:{...payload,roomApplied:result.applied,roomToggledOff:result.toggledOff===true},events:[...result.events,...cured.events]};}
};
