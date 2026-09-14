import {applyRoom} from '../rooms.mjs';
import {resolveNegativeStageResetItems,resolvePpRestoreItems,resolveStatusCureItems,resolveTerrainSeedItems,resolveVolatileCureItems} from '../item-hooks.mjs';

export const applyRoomHandler={
 id:'apply-room',hooks:['onMove'],
 run({battle,payload,params}){const result=applyRoom(battle,{actorId:payload.action.actorId,moveId:payload.move.id,room:params.room,defaultTurns:params.turns||5});let next=result.battle,events=[...result.events];if(params.room==='magic-room'&&result.toggledOff){const cured=resolveStatusCureItems(next,{trigger:'magic-room-ended'});next=cured.battle;events.push(...cured.events);const volatile=resolveVolatileCureItems(next,{trigger:'magic-room-ended'});next=volatile.battle;events.push(...volatile.events);const reset=resolveNegativeStageResetItems(next,{trigger:'magic-room-ended'});next=reset.battle;events.push(...reset.events);const pp=resolvePpRestoreItems(next,{trigger:'magic-room-ended'});next=pp.battle;events.push(...pp.events);const seeds=resolveTerrainSeedItems(next,{trigger:'magic-room-ended'});next=seeds.battle;events.push(...seeds.events);}return {battle:next,payload:{...payload,roomApplied:result.applied,roomToggledOff:result.toggledOff===true},events};}
};
