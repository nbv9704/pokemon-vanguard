import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseAdventureStorage,HybridAdventureStorage} from '../server/storage-supabase.mjs';
const remote=fetchImpl=>new SupabaseAdventureStorage({url:'https://db.example.invalid',secretKey:'test-key',fetchImpl,timeoutMs:25});

test('Supabase deadline covers a stalled response body after successful HTTP headers',async()=>{
 const storage=remote(async()=>new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(storage.request('game_saves'),error=>error.code==='STORAGE_TIMEOUT'&&error.retryable);
});

test('Supabase rejects oversized and invalid response JSON without exposing upstream content',async()=>{
 const large=remote(async()=>new Response('{}',{headers:{'Content-Length':'20000000'}}));
 await assert.rejects(large.request('game_saves'),error=>error.code==='STORAGE_RESPONSE_TOO_LARGE');
 const invalid=remote(async()=>new Response('secret response body',{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(async()=>{await (await invalid.request('game_saves')).json();},error=>error.code==='STORAGE_BAD_JSON'&&!error.message.includes('secret'));
});

test('mixed-provider pair-save fails before either account is written',async()=>{
 let writes=0;const local={savePair:async()=>{writes++;return {duplicate:false};}},cloud={configured:true,isAccountRoom:id=>id.startsWith('cloud'),savePair:async()=>{writes++;return {duplicate:false};}};
 const hybrid=new HybridAdventureStorage({local,remote:cloud});
 assert.throws(()=>hybrid.savePair([{userId:'cloud-user',state:{}},{userId:'local-user',state:{}}],'social:cross'),error=>error.code==='STORAGE_PAIR_CROSS_BACKEND');
 assert.equal(writes,0);
});
