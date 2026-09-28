export class AccountCoordinator{
 constructor(){this.pending=[];this.active=new Set();}
  withAccounts(accountIds,work){
  if(typeof work!=='function')return Promise.reject(new TypeError('AccountCoordinator work must be a function'));
  const ids=[...new Set((accountIds||[]).map(String).filter(Boolean))].sort();
  return new Promise((resolve,reject)=>{this.pending.push({ids,work,resolve,reject});this.drain();});
 }
 drain(){for(let index=0;index<this.pending.length;){const entry=this.pending[index];if(entry.ids.some(id=>this.active.has(id))){index++;continue;}this.pending.splice(index,1);for(const id of entry.ids)this.active.add(id);void Promise.resolve().then(entry.work).then(entry.resolve,entry.reject).finally(()=>{for(const id of entry.ids)this.active.delete(id);this.drain();});}}
}
