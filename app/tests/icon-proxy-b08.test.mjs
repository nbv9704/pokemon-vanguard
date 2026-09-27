import test from 'node:test';
import assert from 'node:assert/strict';
import {createPokemonUiIconProxy} from '../server/pokemon-ui-icons.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlD9H0AAAAASUVORK5CYII=','base64');
function request(method='GET'){return {method};}
function response(){return {status:null,headers:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(data){this.bytes=data;}};}
const route=new URL('http://localhost/api/ui-symbols/type-icon/fire');

test('concurrent GET and HEAD share one allowlisted fetch and successful PNG cache',async()=>{
 let calls=0;const proxy=createPokemonUiIconProxy({fetchImpl:async(url,init)=>{calls++;assert.match(url,/bulbagarden/);assert.ok(init.signal);await new Promise(resolve=>setTimeout(resolve,10));return new Response(png,{headers:{'Content-Type':'image/png'}});}});
 const a=response(),b=response();await Promise.all([proxy(request('GET'),a,route),proxy(request('HEAD'),b,route)]);
 assert.equal(calls,1);assert.equal(a.status,200);assert.deepEqual(a.bytes,png);assert.equal(b.status,200);assert.equal(b.bytes,undefined);
 const c=response();await proxy(request(),c,route);assert.equal(calls,1);assert.equal(c.status,200);
 const invalid=response();assert.equal(await proxy(request(),invalid,new URL('http://localhost/api/ui-symbols/type-icon/../../../evil')),false);
});

test('icon proxy fails closed for large, non-PNG, corrupt and hanging upstream responses',async()=>{
 const scenarios=[
  async()=>new Response('not-png',{headers:{'Content-Type':'image/png'}}),
  async()=>new Response(png,{headers:{'Content-Type':'image/svg+xml'}}),
  async()=>new Response(png,{headers:{'Content-Type':'image/png','Content-Length':'5000000'}}),
  async()=>new Response(new Uint8Array(300),{headers:{'Content-Type':'image/png'}})
 ];
 for(const fetchImpl of scenarios){const res=response();await createPokemonUiIconProxy({fetchImpl})(request(),res,route);assert.equal(res.status,502);}
 const never=()=>new Promise(()=>{});const timeout=response();await createPokemonUiIconProxy({fetchImpl:never,timeoutMs:20})(request(),timeout,route);assert.equal(timeout.status,504);
 const stallsAfterHeaders=response();const body=new ReadableStream({start(){}});
 await createPokemonUiIconProxy({fetchImpl:async()=>new Response(body,{headers:{'Content-Type':'image/png'}}),timeoutMs:20})(request(),stallsAfterHeaders,route);
 assert.equal(stallsAfterHeaders.status,504,'deadline also applies to body consumption');
});
