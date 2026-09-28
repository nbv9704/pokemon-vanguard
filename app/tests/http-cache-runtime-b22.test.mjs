import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';
import {createCatalogHttpResponse} from '../server/http-public-assets.mjs';

function wireRequest(url,{headers={},method='GET'}={}){
 return new Promise((resolve,reject)=>{const req=http.request(url,{headers,method},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});
}

function liveState(port){
 return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/http-cache-runtime`),timer=setTimeout(()=>{ws.terminate();reject(new Error('websocket state timeout'));},5000);ws.once('open',()=>ws.send(JSON.stringify({type:'join',playerId:'cache-runtime'})));ws.on('message',raw=>{const frame=JSON.parse(raw);if(frame.type!=='state')return;clearTimeout(timer);resolve({ws,frame});});ws.once('error',reject);});
}

test('runtime cache supports cold Brotli, warm 304, private no-store and live WebSocket together',async()=>{
 const saveDir=await mkdtemp(path.join(os.tmpdir(),'pv-http-runtime-')),app=createLocalServer({saveDir});
 try{
  const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
  const cold=await wireRequest(base+'/api/v3/catalog',{headers:{'Accept-Encoding':'br'}});
  assert.equal(cold.status,200);assert.equal(cold.headers['content-encoding'],'br');assert.ok(Number(cold.headers['content-length'])>0);assert.equal(cold.body.length,Number(cold.headers['content-length']));
  const etag=cold.headers.etag;assert.ok(etag);
  const warm=await wireRequest(base+'/api/v3/catalog',{headers:{'Accept-Encoding':'br','If-None-Match':etag}});
  assert.equal(warm.status,304);assert.equal(warm.body.length,0);assert.equal(warm.headers.etag,etag);
  const session=await wireRequest(base+'/api/auth/session');assert.equal(session.status,200);assert.equal(session.headers['cache-control'],'no-store');
  const {ws,frame}=await liveState(port);assert.equal(frame.status,'playing');
  const duringSocket=await wireRequest(base+'/api/v3/catalog',{headers:{'If-None-Match':etag}});assert.equal(duringSocket.status,304);assert.equal(duringSocket.body.length,0);
  await new Promise(resolve=>{ws.once('close',resolve);ws.close();});
 }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});

test('catalog content changes produce a different ETag and cannot reuse a stale 304',()=>{
 const responses=[];
 const request={method:'GET',headers:{'accept-encoding':'identity'}};
 const invoke=(serve,headers={})=>{const result={status:null,headers:null,body:null},res={writeHead(status,value){result.status=status;result.headers=value;},end(body){result.body=body??Buffer.alloc(0);}};serve({...request,headers:{...request.headers,...headers}},res);responses.push(result);return result;};
 const first=invoke(createCatalogHttpResponse({version:'one',species:[]}));
 const changed=invoke(createCatalogHttpResponse({version:'two',species:[]}),{'if-none-match':first.headers.ETag});
 assert.equal(first.status,200);assert.equal(changed.status,200);assert.notEqual(changed.headers.ETag,first.headers.ETag);assert.match(changed.body.toString(),/"two"/u);
});
