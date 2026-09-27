import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneDetachedRooms,roomResourceSnapshot,DETACHED_ROOM_RETENTION_MS} from '../server/room-lifecycle.mjs';

const room=({clients=0,pending=0,jobs=0,detached=100,active=detached,dirty=false}={})=>({clients:{size:clients},pendingSockets:{size:pending},queue:{depth:jobs},lastDetachedAt:detached,lastActiveAt:active,dirty});
test('room cleanup never evicts connected, joining, queued, PvP or grace-period accounts',()=>{
 const now=DETACHED_ROOM_RETENTION_MS+200;
 const rooms=new Map([['connected',room({clients:1})],['joining',room({pending:1})],['queued',room({jobs:1})],['dirty',room({dirty:true})],['pvp',room()],['recent',room({detached:now-100})],['fresh',room({detached:null})],['detached',room()]]);
 const evicted=[];const count=pruneDetachedRooms(rooms,{now,isBusy:id=>id==='pvp',onEvict:id=>evicted.push(id)});
 assert.equal(count,1);assert.deepEqual(evicted,['detached']);assert.equal(rooms.size,7);
 assert.equal(pruneDetachedRooms(rooms,{now,isBusy:()=>true}),0);
});

test('capacity cleanup evicts least-recently-active safe rooms and reports reasons',()=>{
 const rooms=new Map([['oldest',room({detached:900,active:100})],['newer',room({detached:800,active:500})],['active',room({clients:1,detached:null,active:999})],['dirty',room({dirty:true,active:1})]]),evicted=[];
 assert.equal(pruneDetachedRooms(rooms,{now:1000,retentionMs:10_000,targetSize:3,onEvict:(id,reason)=>evicted.push([id,reason])}),1);
 assert.deepEqual(evicted,[['oldest','capacity']]);assert.deepEqual([...rooms.keys()],['newer','active','dirty']);
});

test('resource snapshot exposes bounded aggregate counts without account details',()=>{
 const rooms=new Map([['a',room({clients:2,jobs:1,detached:null})],['b',room({pending:1,dirty:true})],['c',room()]]),snapshot=roomResourceSnapshot(rooms,{maxRooms:8,counters:{ttl:2,capacity:3,capacityRejected:4},isBusy:id=>id==='c'});
 assert.deepEqual(snapshot,{rooms:3,maxRooms:8,activeRooms:2,detachedRooms:1,dirtyRooms:1,busyRooms:1,connectedSockets:2,pendingSockets:1,queuedJobs:1,oldestQueueWaitMs:0,evictions:{ttl:2,capacity:3},capacityRejected:4});
 assert.equal(Object.hasOwn(snapshot,'a'),false);assert.equal(Object.hasOwn(snapshot,'b'),false);assert.equal(Object.hasOwn(snapshot,'c'),false);
});
