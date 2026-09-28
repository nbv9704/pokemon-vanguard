// B08: single-process resource guards, using the socket's actual remoteAddress.
// Forwarded headers are deliberately ignored until a trusted proxy contract exists.
/** @param {unknown} value @param {number} fallback */
const validPositive=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:fallback;
/** @typedef {{ok:boolean,retryAfterMs:number,capacityExceeded?:boolean}} QuotaResult */

/** @param {{capacity?:number,windowMs?:number,maxKeys?:number,idleMs?:number,now?:()=>number}} [options] */
export function createTokenBucket({capacity=60,windowMs=10_000,maxKeys=20_000,idleMs=120_000,now=()=>Date.now()}={}){
 capacity=Math.min(100_000,validPositive(capacity,60));
 windowMs=Math.max(1,validPositive(windowMs,10_000));
 maxKeys=Math.max(1,Math.floor(validPositive(maxKeys,20_000)));
 idleMs=Math.max(windowMs,validPositive(idleMs,120_000));
 /** @type {Map<string,{tokens:number,updatedAt:number,lastSeen:number}>} */
 const buckets=new Map();const rate=capacity/windowMs;
 /** @param {string} key @param {number} time */
 function current(key,time){
  let entry=buckets.get(key);
  if(!entry){
   if(buckets.size>=maxKeys){prune(time);if(buckets.size>=maxKeys)return null;}
   entry={tokens:capacity,updatedAt:time,lastSeen:time};buckets.set(key,entry);
  }
  const elapsed=Math.max(0,time-entry.updatedAt);
  entry.tokens=Math.min(capacity,entry.tokens+elapsed*rate);
  entry.updatedAt=time;entry.lastSeen=time;
  return entry;
 }
 /** @param {string} key @param {{cost?:number,at?:number}} [options] @returns {QuotaResult} */
 function inspect(key,{cost=1,at=now()}={}){
  if(typeof key!=='string'||!key||!Number.isFinite(cost)||cost<=0||cost>capacity)return {ok:false,retryAfterMs:windowMs};
  const entry=current(key,at);if(!entry)return {ok:false,retryAfterMs:idleMs,capacityExceeded:true};
  const missing=Math.max(0,cost-entry.tokens);
  return {ok:missing===0,retryAfterMs:missing?Math.ceil(missing/rate):0};
 }
 /** @param {string} key @param {{cost?:number,at?:number}} [options] @returns {QuotaResult} */
 function take(key,{cost=1,at=now()}={}){
  const result=inspect(key,{cost,at});const entry=buckets.get(key);
  if(result.ok&&entry)entry.tokens-=cost;
  return result;
 }
 function prune(at=now()){
  for(const [key,entry] of buckets)if(at-entry.lastSeen>=idleMs)buckets.delete(key);
  return buckets.size;
 }
 return {inspect,take,prune,size:()=>buckets.size};
}

/** @param {{now?:()=>number,limits?:Partial<Record<'accountActions'|'ipActions'|'socketMessages'|'ipUpgrades'|'httpInspector',number>>}} [options] */
export function createRequestQuotas({now=()=>Date.now(),limits={}}={}){
 const config={
  accountActions:{capacity:limits.accountActions??45,windowMs:10_000},
  ipActions:{capacity:limits.ipActions??180,windowMs:10_000},
  socketMessages:{capacity:limits.socketMessages??70,windowMs:10_000},
  ipUpgrades:{capacity:limits.ipUpgrades??30,windowMs:60_000},
  httpInspector:{capacity:limits.httpInspector??40,windowMs:60_000}
 };
 /** @type {Record<keyof typeof config,ReturnType<typeof createTokenBucket>>} */
 const buckets={
  accountActions:createTokenBucket({...config.accountActions,now}),
  ipActions:createTokenBucket({...config.ipActions,now}),
  socketMessages:createTokenBucket({...config.socketMessages,now}),
  ipUpgrades:createTokenBucket({...config.ipUpgrades,now}),
  httpInspector:createTokenBucket({...config.httpInspector,now})
 };
 /** @type {WeakMap<object,ReturnType<typeof createTokenBucket>>} */
 const sockets=new WeakMap();
 /** @param {ReadonlyArray<readonly [ReturnType<typeof createTokenBucket>,string]>} entries */
 function allow(entries){
  const at=now();let wait=0;
  for(const [bucket,key] of entries){const result=bucket.inspect(key,{at});if(!result.ok)wait=Math.max(wait,result.retryAfterMs);}
  if(wait)return {ok:false,retryAfterMs:wait};
  for(const [bucket,key] of entries)bucket.take(key,{at});
  return {ok:true,retryAfterMs:0};
 }
 /** @param {{accountId:string,ip:string,socket:object}} payload */
 function message({accountId,ip,socket}){
  let own=sockets.get(socket);if(!own){own=createTokenBucket({...config.socketMessages,maxKeys:1,now});sockets.set(socket,own);}
  return allow([[own,'socket'],[buckets.accountActions,accountId],[buckets.ipActions,ip]]);
 }
 return {
  message,
  /** @param {string} ip */
  upgrade:ip=>allow([[buckets.ipUpgrades,ip]]),
  /** @param {string} ip */
  inspector:ip=>allow([[buckets.httpInspector,ip]]),
  prune:()=>Object.values(buckets).forEach(bucket=>bucket.prune()),
  sizes:()=>Object.fromEntries(Object.entries(buckets).map(([key,bucket])=>[key,bucket.size()]))
 };
}
