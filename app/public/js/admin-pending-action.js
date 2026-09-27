// Keep one pending Admin action per signed-in admin in this browser tab. A lost
// HTTP reply is ambiguous: retry EXACTLY the same payload and operation ID.
export class AdminPendingAction{
 constructor(storage,adminId){this.storage=storage;this.key=`pv-admin-action-pending-v1:${adminId}`;this.pending=null;try{const value=JSON.parse(storage?.getItem(this.key)||'null');if(value?.userId&&value?.action?.actionId&&value?.action?.type)this.pending=value;}catch{}}
 get(){return this.pending;}
 set(value){this.pending=value;try{if(value)this.storage?.setItem(this.key,JSON.stringify(value));else this.storage?.removeItem(this.key);}catch{}}
 begin(userId,action,makeId){if(this.pending)throw new Error('Resolve the pending Admin action before starting another.');const pending={userId,action:{...action,actionId:makeId()}};this.set(pending);return pending;}
 complete(actionId){if(this.pending?.action.actionId===actionId)this.set(null);}
}
