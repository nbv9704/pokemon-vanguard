// Evict only committed, detached owner projections. Active external PvP references
// and in-flight jobs keep rooms alive. A future join reloads the durable save.
export const DETACHED_ROOM_RETENTION_MS=10*60_000;
const detached=(accountId,room,isBusy)=>!room.clients.size&&!room.pendingSockets?.size&&!room.queue.depth&&!room.dirty&&room.lastDetachedAt!=null&&!isBusy(accountId);
const age=(room,key)=>Number.isFinite(room[key])?room[key]:Number.MAX_SAFE_INTEGER;

export function pruneDetachedRooms(rooms,{now,retentionMs=DETACHED_ROOM_RETENTION_MS,targetSize=Infinity,isBusy=()=>false,onEvict=()=>{}}){
 let removed=0;
 const evict=(accountId,reason)=>{if(!rooms.delete(accountId))return;onEvict(accountId,reason);removed++;};
 for(const [accountId,room] of rooms)if(detached(accountId,room,isBusy)&&now-room.lastDetachedAt>=retentionMs)evict(accountId,'ttl');
 let overflow=rooms.size-Math.max(0,targetSize);
 if(overflow>0){
  const candidates=[...rooms].filter(([accountId,room])=>detached(accountId,room,isBusy)).sort(([,left],[,right])=>age(left,'lastActiveAt')-age(right,'lastActiveAt')||age(left,'lastDetachedAt')-age(right,'lastDetachedAt'));
  for(const [accountId] of candidates){if(overflow--<=0)break;evict(accountId,'capacity');}
 }
 return removed;
}

export function roomResourceSnapshot(rooms,{maxRooms,counters={},isBusy=()=>false}={}){
 let connectedSockets=0,pendingSockets=0,queuedJobs=0,activeRooms=0,detachedRooms=0,dirtyRooms=0,busyRooms=0;
 for(const [accountId,room] of rooms){
  connectedSockets+=room.clients.size;pendingSockets+=room.pendingSockets?.size||0;queuedJobs+=room.queue.depth||0;
  if(room.clients.size||room.pendingSockets?.size)activeRooms++;else detachedRooms++;
  if(room.dirty)dirtyRooms++;if(isBusy(accountId))busyRooms++;
 }
 return {rooms:rooms.size,maxRooms,activeRooms,detachedRooms,dirtyRooms,busyRooms,connectedSockets,pendingSockets,queuedJobs,evictions:{ttl:counters.ttl||0,capacity:counters.capacity||0},capacityRejected:counters.capacityRejected||0};
}
