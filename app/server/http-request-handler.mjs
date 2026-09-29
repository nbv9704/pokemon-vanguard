import {inspectV2Damage} from './v2-damage-inspector.mjs';

// Transport-only HTTP routing. Auth/admin own their response bodies; this layer
// never serializes session, storage, or other internal state into an error.
export async function readJsonBody(req,maxBytes=32*1024){
 let size=0,chunks=[];
 for await(const chunk of req){
  size+=chunk.length;
  if(size>maxBytes)throw Object.assign(new Error('Request too large'),{statusCode:413});
  chunks.push(chunk);
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Keep route precedence and HEAD behavior explicit and testable without a server. */
export function createHttpRequestHandler({isClosing,readiness,requestPolicy,auth,admin,sessionCommits={run:(_session,work)=>work()},quotas,v2Catalog,serveV2Catalog,serveV3Catalog,serveAssetConfig,serveStatic}){
 return async function handleHttp(req,res){
  try{
   const healthPath=new URL(req.url,'http://localhost').pathname;
   if(healthPath==='/health/live'||healthPath==='/health/ready'){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Cache-Control':'no-store'});return res.end();}
    const good=!isClosing()&&(healthPath==='/health/live'||await readiness.ready());
    res.writeHead(good?200:503,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return res.end(req.method==='HEAD'?undefined:JSON.stringify({status:good?'ok':'unavailable'}));
   }
   const url=requestPolicy.requestUrl(req);
   if(await auth.handle(req,res,url))return;
   const adminSession=auth.authenticate?await auth.authenticate(req):auth.readSession(req);
   if(await sessionCommits.run(adminSession,()=>admin.handle(req,res,url,adminSession)))return;
   const pathname=decodeURIComponent(url.pathname);
   if(pathname==='/api/v2/damage'){
    if(req.method!=='POST'){res.writeHead(405);return res.end();}
    const quota=quotas.inspector(requestPolicy.clientIp(req));
    if(!quota.ok){res.writeHead(429,{'Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil(quota.retryAfterMs/1000)))});return res.end();}
    const result=inspectV2Damage(await readJsonBody(req),v2Catalog);
    res.writeHead(result.ok?200:400,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return res.end(JSON.stringify(result));
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
   if(pathname==='/api/v2/catalog')return serveV2Catalog(req,res);
   if(pathname==='/api/v3/catalog')return serveV3Catalog(req,res);
   if(pathname==='/api/assets/config'&&serveAssetConfig)return serveAssetConfig(req,res);
   return await serveStatic(req,res,pathname);
  }catch(error){
   // A downstream handler may have already sent headers. Abort the partial
   // response rather than turning a failed transfer into a false HTTP 200.
   if(res.headersSent){res.destroy();return;}
   res.writeHead(error.statusCode||(error.code==='ENOENT'?404:400));
   return res.end('Not found');
  }
 };
}
