import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneDetachedRooms,DETACHED_ROOM_RETENTION_MS} from '../server/room-lifecycle.mjs';

const room=({clients=0,pending=0,jobs=0,detached=100}={})=>({clients:{size:clients},pendingSockets:{size:pending},queue:{depth:jobs},lastDetachedAt:detached});
test('room cleanup never evicts connected, joining, queued, PvP or grace-period accounts',()=>{
 const now=DETACHED_ROOM_RETENTION_MS+200;
 const rooms=new Map([['connected',room({clients:1})],['joining',room({pending:1})],['queued',room({jobs:1})],['pvp',room()],['recent',room({detached:now-100})],['fresh',room({detached:null})],['detached',room()]]);
 const evicted=[];const count=pruneDetachedRooms(rooms,{now,isBusy:id=>id==='pvp',onEvict:id=>evicted.push(id)});
 assert.equal(count,1);assert.deepEqual(evicted,['detached']);assert.equal(rooms.size,6);
 assert.equal(pruneDetachedRooms(rooms,{now,isBusy:()=>true}),0);
});
