// Public-only HTTP cache. Never feed account/session/admin responses into this module.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream';
import {createBrotliCompress,createGzip,brotliCompressSync,gzipSync} from 'node:zlib';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.ico':'image/x-icon'};
const TEXT=/^(text\/|application\/(?:json|javascript))/;
const MAX_CACHE_ENTRIES=48, MAX_CACHE_BYTES=8*1024*1024, MAX_SMALL_FILE=512*1024;
const sha256=body=>'"'+createHash('sha256').update(body).digest('hex')+'"';
const matchesEtag=(header,tag)=>typeof header==='string'&&header.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===tag);
export function negotiatedEncoding(header=''){
 const preferences=new Map();for(const part of String(header).split(',')){const [name,...parts]=part.trim().toLowerCase().split(';');const q=parts.find(value=>value.trim().startsWith('q='));const weight=q?Number(q.trim().slice(2)):1;if(name&&Number.isFinite(weight))preferences.set(name,Math.min(1,Math.max(0,weight)));}
 if(!preferences.size)return null;
 const wildcard=preferences.get('*'),available=name=>preferences.has(name)?preferences.get(name):wildcard??0;
 const identity=preferences.has('identity')?preferences.get('identity'):wildcard===0?0:1;
 const candidates=[['br',available('br'),2],['gzip',available('gzip'),1],['identity',identity,0]].filter(([,weight])=>weight>0).sort((a,b)=>b[1]-a[1]||b[2]-a[2]);
 if(!candidates.length)return false;return candidates[0][0]==='identity'?null:candidates[0][0];
}
export function createCatalogHttpResponse(data){
 const body=Buffer.from(JSON.stringify(data)),etag=sha256(body);
 const encodings={identity:body,gzip:gzipSync(body),br:brotliCompressSync(body)};
 return function serveCatalog(req,res){
  const encoding=negotiatedEncoding(req.headers['accept-encoding']);
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, no-cache','X-Content-Type-Options':'nosniff','ETag':etag,'Vary':'Accept-Encoding'};
  if(encoding===false){res.writeHead(406,headers);res.end();return;}
  if(matchesEtag(req.headers['if-none-match'],etag)){res.writeHead(304,headers);res.end();return;}
  const payload=encodings[encoding||'identity'];if(encoding)headers['Content-Encoding']=encoding;
  headers['Content-Length']=String(payload.length);
  res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:payload);
 };
}
export function createAssetConfigHttpResponse({baseUrl=''}={}){
 let safeBase='';
 try{const value=String(baseUrl||'').trim(),url=value?new URL(value):null;if(url&&!url.username&&!url.password&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(url.hostname))))safeBase=url.href.replace(/\/+$/,'');}catch{}
 const body=Buffer.from(JSON.stringify({schemaVersion:1,baseUrl:safeBase,manifestPath:'/asset-manifest.json'}));
 return function serveAssetConfig(req,res){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60, must-revalidate','X-Content-Type-Options':'nosniff','Content-Length':String(body.length)};res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);};
}
function streamToResponse(reader,transform,res){
 // Pipeline owns the reader, compressor and response; all I/O errors are handled.
 const done=error=>{if(error&&!res.destroyed)res.destroy(error);};
 if(transform)pipeline(reader,transform,res,done);else pipeline(reader,res,done);
}
export function createStaticHttpResponse(publicDir){
 const root=path.resolve(publicDir),realRootPromise=realpath(root).catch(()=>root),cache=new Map();let cacheBytes=0;
 const isWithin=(parent,candidate)=>{const relative=path.relative(parent,candidate);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
 function remember(key,value){
  if(value.identity.length>MAX_CACHE_BYTES)return;
  cache.set(key,value);cacheBytes+=value.identity.length;
  while(cache.size>MAX_CACHE_ENTRIES||cacheBytes>MAX_CACHE_BYTES){const [old,entry]=cache.entries().next().value;cache.delete(old);cacheBytes-=entry.identity.length;}
 }
 return async function serveStatic(req,res,pathname){
  const filepath=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!isWithin(root,filepath)){res.writeHead(403);res.end();return;}
  let stats,real,realRoot;
  try{[stats,real,realRoot]=await Promise.all([lstat(filepath),realpath(filepath),realRootPromise]);}catch{res.writeHead(404);res.end();return;}
  if(!stats.isFile()||!isWithin(realRoot,real)){res.writeHead(404);res.end();return;}
  const type=MIME[path.extname(filepath).toLowerCase()]||'application/octet-stream';
  const compressible=TEXT.test(type),key=filepath+':'+stats.size+':'+stats.mtimeMs;
  // Never immutable-cache URL names merely because an unversioned file contains numbers.
  const hashed=/[.-][a-f\d]{10,}[.-]/i.test(path.basename(filepath));
  const headers={'Content-Type':type,'Cache-Control':hashed?'public, max-age=31536000, immutable':'public, no-cache','X-Content-Type-Options':'nosniff','Last-Modified':stats.mtime.toUTCString()};
  let cached=cache.get(key);
  if(cached){cache.delete(key);cache.set(key,cached);} // bounded LRU
  if(!cached&&compressible&&stats.size<=MAX_SMALL_FILE){
   const body=await readFile(filepath);
   cached={identity:body,br:brotliCompressSync(body),gzip:gzipSync(body),etag:sha256(body)};remember(key,cached);
  }
  const etag=cached?.etag||'W/"'+stats.size.toString(16)+'-'+Math.floor(stats.mtimeMs).toString(16)+'"';
  headers.ETag=etag;
  if(compressible)headers.Vary='Accept-Encoding';
  if(matchesEtag(req.headers['if-none-match'],etag)){res.writeHead(304,headers);res.end();return;}
  const encoding=compressible?negotiatedEncoding(req.headers['accept-encoding']):null;
  if(encoding===false){res.writeHead(406,headers);res.end();return;}
  if(encoding)headers['Content-Encoding']=encoding;
  if(cached){const payload=cached[encoding||'identity'];headers['Content-Length']=String(payload.length);res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:payload);return;}
  if(!encoding)headers['Content-Length']=String(stats.size);
  res.writeHead(200,headers);if(req.method==='HEAD'){res.end();return;}
  const reader=createReadStream(filepath);streamToResponse(reader,encoding?(encoding==='br'?createBrotliCompress():createGzip()):null,res);
 };
}
