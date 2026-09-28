import {mkdtemp,rm} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';

const sampleCount=Math.max(3,Number.parseInt(process.env.PV_HTTP_BENCHMARK_SAMPLES||'10',10)||10);
const saveDir=await mkdtemp(path.join(os.tmpdir(),'pv-http-benchmark-'));
const app=createLocalServer({saveDir});

function request(url,{headers={},method='GET'}={}){
 const started=performance.now();
 return new Promise((resolve,reject)=>{const req=http.request(url,{headers,method},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks).length,ms:performance.now()-started}));});req.on('error',reject);req.end();});
}
const percentile=(values,ratio)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*ratio))];};
const summary=values=>({p50Ms:Number(percentile(values,.5).toFixed(3)),p95Ms:Number(percentile(values,.95).toFixed(3)),minMs:Number(Math.min(...values).toFixed(3)),maxMs:Number(Math.max(...values).toFixed(3))});

try{
 const port=await app.listen(0),base=`http://127.0.0.1:${port}`;
 const coldCatalog=await request(base+'/api/v3/catalog',{headers:{'Accept-Encoding':'br'}}),catalogWarm=[],staticCold=await request(base+'/',{headers:{'Accept-Encoding':'br'}}),staticWarm=[];
 for(let index=0;index<sampleCount;index++){catalogWarm.push(await request(base+'/api/v3/catalog',{headers:{'Accept-Encoding':'br','If-None-Match':coldCatalog.headers.etag}}));staticWarm.push(await request(base+'/',{headers:{'Accept-Encoding':'br','If-None-Match':staticCold.headers.etag}}));}
 const privateSession=await request(base+'/api/auth/session');
 const socketStarted=performance.now(),socket=await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/http-benchmark`);ws.once('open',()=>resolve(ws));ws.once('error',reject);});
 const websocketHandshakeMs=performance.now()-socketStarted;socket.close();
 if(coldCatalog.status!==200||coldCatalog.headers['content-encoding']!=='br'||catalogWarm.some(entry=>entry.status!==304||entry.bytes!==0)||staticWarm.some(entry=>entry.status!==304||entry.bytes!==0)||privateSession.headers['cache-control']!=='no-store')throw new Error('HTTP runtime benchmark contract failed');
 console.log(JSON.stringify({node:process.version,samples:sampleCount,catalog:{cold:{status:coldCatalog.status,wireBytes:coldCatalog.bytes,ms:Number(coldCatalog.ms.toFixed(3)),encoding:coldCatalog.headers['content-encoding']},warm304:summary(catalogWarm.map(entry=>entry.ms)),warmWireBytes:catalogWarm.reduce((sum,entry)=>sum+entry.bytes,0)},index:{cold:{status:staticCold.status,wireBytes:staticCold.bytes,ms:Number(staticCold.ms.toFixed(3)),encoding:staticCold.headers['content-encoding']||'identity'},warm304:summary(staticWarm.map(entry=>entry.ms)),warmWireBytes:staticWarm.reduce((sum,entry)=>sum+entry.bytes,0)},privateSession:{status:privateSession.status,cacheControl:privateSession.headers['cache-control']},websocket:{handshakeMs:Number(websocketHandshakeMs.toFixed(3))}},null,2));
}finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
