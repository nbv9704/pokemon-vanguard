const finite=value=>Number.isFinite(value)&&value>=0?value:0;
const round=value=>Math.round(value*1000)/1000;

class RecentDistribution{
 constructor(limit=512){this.limit=limit;this.values=[];this.cursor=0;this.total=0;this.max=0;}
 observe(value){value=finite(value);this.total++;this.max=Math.max(this.max,value);if(this.values.length<this.limit)this.values.push(value);else{this.values[this.cursor]=value;this.cursor=(this.cursor+1)%this.limit;}}
 snapshot(){const sorted=[...this.values].sort((a,b)=>a-b),at=percent=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*percent)-1)]:0;return {samples:this.total,recentSamples:sorted.length,p50Ms:round(at(.5)),p95Ms:round(at(.95)),maxMs:round(this.max)};}
}

export class RuntimeMetrics{
 constructor({memoryUsage=()=>process.memoryUsage()}={}){this.memoryUsage=memoryUsage;this.persist=new RecentDistribution();this.eventLoop=new RecentDistribution();this.persistErrors=0;this.persistFailureTimes=[];this.broadcasts=0;this.broadcastDeliveries=0;this.broadcastBytes=0;this.socketDrops={backpressure:0,closed:0,error:0};}
 async measurePersist(work){const started=performance.now();try{return await work();}catch(error){this.persistErrors++;this.persistFailureTimes.push(Date.now());if(this.persistFailureTimes.length>512)this.persistFailureTimes.shift();throw error;}finally{this.persist.observe(performance.now()-started);}}
 observeEventLoopLag(ms){this.eventLoop.observe(ms);}
 observeBroadcast({deliveredSockets=0,deliveredBytes=0}={}){this.broadcasts++;this.broadcastDeliveries+=deliveredSockets;this.broadcastBytes+=deliveredBytes;}
 observeSocketDrop(reason){if(Object.hasOwn(this.socketDrops,reason))this.socketDrops[reason]++;}
 snapshot(){const memory=this.memoryUsage(),since=Date.now()-300_000;this.persistFailureTimes=this.persistFailureTimes.filter(at=>at>=since);return {persist:{...this.persist.snapshot(),errors:this.persistErrors,recentErrors:this.persistFailureTimes.length},eventLoop:this.eventLoop.snapshot(),memory:{heapUsedBytes:finite(memory.heapUsed),heapTotalBytes:finite(memory.heapTotal),rssBytes:finite(memory.rss)},broadcast:{frames:this.broadcasts,deliveries:this.broadcastDeliveries,bytes:this.broadcastBytes},socketDrops:{...this.socketDrops}};}
}

export function instrumentPersistence(storage,metrics,methods=['save','savePair','restore'],onFailure=()=>{},onSuccess=()=>{}){
 for(const method of methods){
  if(typeof storage[method]!=='function')continue;
  const original=storage[method].bind(storage);
  storage[method]=(...args)=>metrics.measurePersist(async()=>{
   const started=performance.now();
   try{const result=await original(...args);onSuccess({operation:method,elapsedMs:performance.now()-started,revision:method==='save'?args[1]?.revision:undefined});return result;}
   catch(error){onFailure({operation:method,errorCode:error?.code,elapsedMs:performance.now()-started});throw error;}
  });
 }
 return storage;
}
