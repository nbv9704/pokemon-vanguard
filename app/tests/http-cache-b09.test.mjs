import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {createCatalogHttpResponse,createStaticHttpResponse,negotiatedEncoding} from '../server/http-public-assets.mjs';

async function fixture(run,{linkedPublicRoot=false}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'pv-http-b09-'));
 const realPublicDir=path.join(dir,'public');await mkdir(realPublicDir);
 const publicDir=linkedPublicRoot?path.join(dir,'public-link'):realPublicDir;
 if(linkedPublicRoot)await symlink(realPublicDir,publicDir,process.platform==='win32'?'junction':'dir');
 const catalog=createCatalogHttpResponse({species:[{name:'Example',moves:['tackle']}]});
 const serveStatic=createStaticHttpResponse(publicDir);
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/api/v3/catalog')return catalog(req,res);return await serveStatic(req,res,decodeURIComponent(req.url));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run({dir,publicDir:realPublicDir,base:`http://127.0.0.1:${server.address().port}`});}
 finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
}

test('Accept-Encoding honors q=0 and never selects unsupported encodings',()=>{
 assert.equal(negotiatedEncoding('br;q=0, gzip;q=1'),'gzip');
 assert.equal(negotiatedEncoding('br;q=0, gzip;q=0'),null);
 assert.equal(negotiatedEncoding('deflate'),null);
 assert.equal(negotiatedEncoding('br;q=1,gzip;q=0.7'),'br');
 assert.equal(negotiatedEncoding('gzip;q=1,br;q=0.1'),'gzip');
 assert.equal(negotiatedEncoding('identity;q=0,br;q=0,gzip;q=0'),false);
});

test('public catalog uses stable ETag, 304, correct HEAD and both compression formats',async()=>fixture(async({base})=>{
 const url=base+'/api/v3/catalog';
 const raw=await fetch(url,{headers:{'Accept-Encoding':'identity'}}),original=await raw.text();
 assert.equal(raw.status,200);assert.equal(raw.headers.get('cache-control'),'public, no-cache');
 const tag=raw.headers.get('etag');assert.ok(/^"[a-f0-9]{64}"$/.test(tag));
 assert.equal(raw.headers.get('vary'),'Accept-Encoding');
 const condition=await fetch(url,{headers:{'If-None-Match':tag,'Accept-Encoding':'br'}});
 assert.equal(condition.status,304);assert.equal(await condition.text(),'');
 const head=await fetch(url,{method:'HEAD',headers:{'Accept-Encoding':'gzip'}});
 assert.equal(head.status,200);assert.equal(head.headers.get('content-encoding'),'gzip');
 assert.equal(await head.text(),'');
 // fetch decompresses transparently; compare wire bodies using low-level HTTP below.
 for(const [encoding,decompress] of [['gzip',gunzipSync],['br',brotliDecompressSync]]){
  const result=await new Promise((resolve,reject)=>{const req=http.get(url,{headers:{'Accept-Encoding':encoding}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({res,body:Buffer.concat(chunks)}));});req.on('error',reject);});
  assert.equal(result.res.headers['content-encoding'],encoding);
  assert.equal(decompress(result.body).toString(),original);
 }
}));

test('static ETags revalidate on change; HTML not immutable; images never recompressed',async()=>fixture(async({base,dir})=>{
 const publicDir=path.join(dir,'public');
 await writeFile(path.join(publicDir,'index.html'),'<h1>Hi</h1>');
 await writeFile(path.join(publicDir,'icon.png'),Buffer.alloc(1024,1));
 const first=await fetch(base+'/',{headers:{'Accept-Encoding':'identity'}});
 assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'public, no-cache');
 const etag=first.headers.get('etag');
 const notModified=await fetch(base+'/',{headers:{'If-None-Match':etag}});
 assert.equal(notModified.status,304);
 await writeFile(path.join(publicDir,'index.html'),'<h1>Changed text</h1>');
 const changed=await fetch(base+'/',{headers:{'If-None-Match':etag,'Accept-Encoding':'identity'}});
 assert.equal(changed.status,200);assert.equal(await changed.text(),'<h1>Changed text</h1>');
 const image=await fetch(base+'/icon.png',{headers:{'Accept-Encoding':'br'}});
 assert.equal(image.headers.get('content-encoding'),null);assert.equal((await image.arrayBuffer()).byteLength,1024);
 const head=await fetch(base+'/icon.png',{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'1024');
}));

test('static server bounds large-file streams',async()=>fixture(async({base,dir})=>{
 const publicDir=path.join(dir,'public');
 await writeFile(path.join(publicDir,'large.txt'),'b'.repeat(700*1024));
 const response=await fetch(base+'/large.txt',{headers:{'Accept-Encoding':'identity'}});
 assert.equal(response.status,200);assert.equal((await response.text()).length,700*1024);
}));

test('static server accepts a public root reached through a directory link',async()=>fixture(async({base,publicDir})=>{
 await writeFile(path.join(publicDir,'index.html'),'<h1>Linked root</h1>');
 const response=await fetch(base+'/',{headers:{'Accept-Encoding':'identity'}});
 assert.equal(response.status,200);assert.equal(await response.text(),'<h1>Linked root</h1>');
},{linkedPublicRoot:true}));

test('static server rejects a linked directory outside public root',async()=>fixture(async({base,dir})=>{
 const publicDir=path.join(dir,'public'),privateDir=path.join(dir,'private');
 await mkdir(privateDir);await writeFile(path.join(privateDir,'secret.txt'),'SECRET');
 await symlink(privateDir,path.join(publicDir,'leak'),process.platform==='win32'?'junction':'dir');
 assert.equal((await fetch(base+'/leak/secret.txt')).status,404);
}));
