export class SerialTaskQueue{
 /** @type {Promise<unknown>} */
 #tail=Promise.resolve();
 #depth=0;
 /** @type {Array<{at:number}>} */
 #waiting=[];
 /** @type {()=>number} */
 #now;
 /** @param {{now?:()=>number}} [options] */
 constructor({now=()=>Date.now()}={}){this.#now=now;}
 get depth(){return this.#depth;}
 /**
  * @template T
  * @param {()=>T|PromiseLike<T>} work
  * @returns {Promise<T>}
  */
 run(work){
  if(typeof work!=='function')return Promise.reject(new TypeError('SerialTaskQueue work must be a function'));
  this.#depth++;const pending={at:this.#now()};this.#waiting.push(pending);
  const job=this.#tail.then(()=>{this.#waiting.splice(this.#waiting.indexOf(pending),1);return work();});
  this.#tail=job.catch(()=>{}).finally(()=>{this.#depth--;});
  return job;
 }
 /** @returns {{depth:number,waiting:number,oldestWaitMs:number}} */
 snapshot(){const oldest=this.#waiting[0];return {depth:this.#depth,waiting:this.#waiting.length,oldestWaitMs:oldest?Math.max(0,this.#now()-oldest.at):0};}
 /** @returns {Promise<unknown>} */
 idle(){return this.#tail;}
}
