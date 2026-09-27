export class SerialTaskQueue{
 #tail=Promise.resolve();
 #depth=0;
 #waiting=[];
 #now;
 constructor({now=()=>Date.now()}={}){this.#now=now;}
 get depth(){return this.#depth;}
 run(work){
  if(typeof work!=='function')return Promise.reject(new TypeError('SerialTaskQueue work must be a function'));
  this.#depth++;const pending={at:this.#now()};this.#waiting.push(pending);
  const job=this.#tail.then(()=>{this.#waiting.splice(this.#waiting.indexOf(pending),1);return work();});
  this.#tail=job.catch(()=>{}).finally(()=>{this.#depth--;});
  return job;
 }
 snapshot(){return {depth:this.#depth,waiting:this.#waiting.length,oldestWaitMs:this.#waiting.length?Math.max(0,this.#now()-this.#waiting[0].at):0};}
 idle(){return this.#tail;}
}
