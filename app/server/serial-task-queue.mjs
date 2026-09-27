export class SerialTaskQueue{
 #tail=Promise.resolve();
 #depth=0;
 get depth(){return this.#depth;}
 run(work){
  if(typeof work!=='function')return Promise.reject(new TypeError('SerialTaskQueue work must be a function'));
  this.#depth++;
  const job=this.#tail.then(()=>work());
  this.#tail=job.catch(()=>{}).finally(()=>{this.#depth--;});
  return job;
 }
 idle(){return this.#tail;}
}
