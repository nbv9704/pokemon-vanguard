import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseAdventureStorage} from '../server/storage-supabase.mjs';
const remote=fetchImpl=>new SupabaseAdventureStorage({url:'https://db.example.invalid',secretKey:'test-key',fetchImpl,timeoutMs:15});

test('cloud request aborts a silent upstream and identifies ambiguous timeout for a write',async()=>{
 let aborted=false;
 const storage=remote((_url,{signal})=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(Object.assign(new Error('aborted'),{name:'AbortError'}));},{once:true});}));
 await assert.rejects(storage.request('rpc/save_game_state_pair',{method:'POST',body:'{}'}),error=>error.code==='STORAGE_TIMEOUT'&&error.retryable===true);
 assert.equal(aborted,true);
});

test('cloud request preserves optimistic-concurrency response status and HTTP error category',async()=>{
 const conflict=remote(async()=>new Response('{}',{status:409}));
 await assert.rejects(conflict.request('game_saves',{method:'POST',body:'{}'}),error=>error.code==='STORAGE_REVISION_CONFLICT'&&error.status===409);
 const unavailable=remote(async()=>new Response('{}',{status:503}));
 await assert.rejects(unavailable.request('game_saves'),error=>error.code==='STORAGE_HTTP_ERROR'&&error.status===503);
});

test('cloud request clears its deadline on success and distinguishes upstream transport failure',async()=>{
 const working=remote(async()=>Response.json([{revision:1}]));assert.deepEqual(await (await working.request('game_saves')).json(),[{revision:1}]);
 const failed=remote(async()=>{throw new TypeError('socket closed');});
 await assert.rejects(failed.request('game_saves'),error=>error.code==='STORAGE_UNAVAILABLE'&&error.retryable===true);
});
