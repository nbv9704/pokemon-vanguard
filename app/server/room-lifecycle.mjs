// Evict only committed, detached owner projections. Active external PvP references
// and in-flight jobs keep rooms alive. A future join reloads the durable save.
export const DETACHED_ROOM_RETENTION_MS=10*60_000;
export function pruneDetachedRooms(rooms,{now,retentionMs=DETACHED_ROOM_RETENTION_MS,isBusy=()=>false,onEvict=()=>{}}){
 let removed=0;
 for(const [accountId,room] of rooms){
  if(room.clients.size||room.pendingSockets?.size||room.queue.depth||room.lastDetachedAt==null||now-room.lastDetachedAt<retentionMs||isBusy(accountId))continue;
  rooms.delete(accountId);onEvict(accountId);removed++;
 }
 return removed;
}
