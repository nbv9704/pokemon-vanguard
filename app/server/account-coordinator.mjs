// A FIFO reservation is needed in addition to the active-account lock: a
// waiting two-account settlement must not be bypassed forever by newer work
// that repeatedly acquires only one of its accounts.
export class AccountCoordinator {
 constructor() {
  /** @type {Array<{ids:string[], start:()=>void}>} */
  this.pending = [];
  /** @type {Set<string>} */
  this.active = new Set();
 }
 /**
  * @template T
  * @param {readonly string[]} accountIds
  * @param {()=>T|PromiseLike<T>} work
  * @returns {Promise<T>}
  */
 withAccounts(accountIds, work) {
  if (typeof work !== 'function') return Promise.reject(new TypeError('AccountCoordinator work must be a function'));
  const ids = [...new Set((accountIds || []).map(String).filter(Boolean))].sort();
  return new Promise((resolve, reject) => {
   this.pending.push({ids, start: () => {
    void Promise.resolve().then(work).then(resolve, reject).finally(() => {
     for (const id of ids) this.active.delete(id);
     this.drain();
    });
   }});
   this.drain();
  });
 }
 drain() {
  // Reserve accounts claimed by earlier blocked jobs before admitting later
  // jobs. Unrelated accounts still run in parallel without head-of-line stall.
  const waiting = new Set();
  for (let index = 0; index < this.pending.length;) {
   const entry = this.pending[index];
   if (!entry) break;
   if (entry.ids.some(id => this.active.has(id) || waiting.has(id))) {
    for (const id of entry.ids) waiting.add(id);
    index++;
    continue;
   }
   this.pending.splice(index, 1);
   for (const id of entry.ids) this.active.add(id);
   entry.start();
  }
 }
}
