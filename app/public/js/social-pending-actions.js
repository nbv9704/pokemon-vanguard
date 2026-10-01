// An explicit retry-only outbox for actions whose server receipts are durable.
// Never auto-resend: the player reviews an uncertain action after reconnect/reload.
const SOCIAL_TYPES=new Set(['socialV1.friend.request','socialV1.friend.accept','socialV1.friend.reject','socialV1.friend.cancel','socialV1.friend.remove','socialV1.chat.send']);
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(id);
export const socialActionLabel=type=>({
 'socialV1.friend.request':'friend request','socialV1.friend.accept':'friend acceptance',
 'socialV1.friend.reject':'friend rejection','socialV1.friend.cancel':'request cancellation',
 'socialV1.friend.remove':'friend removal','socialV1.chat.send':'chat message'
}[type]||'Social action');
const validAction=action=>action&&typeof action==='object'&&!Array.isArray(action)&&SOCIAL_TYPES.has(action.type)&&validId(action.actionId)&&JSON.stringify(action).length<=2048;
export class SocialPendingActions{
 constructor({storage=null,scope}){
  this.storage=storage;this.key=`pv:social-pending:v1:${String(scope||'').slice(0,128)}`;this.current=null;this.lastError=null;this.persistent=!!storage;
  try{const saved=JSON.parse(storage?.getItem(this.key)||'null');if(saved?.version===1&&validAction(saved.action))this.current=saved.action;}catch{this.persistent=false;}
 }
 get pending(){return this.current&&structuredClone(this.current);}
 save(){try{if(this.current)this.storage?.setItem(this.key,JSON.stringify({version:1,action:this.current}));else this.storage?.removeItem(this.key);return !!this.storage;}catch{this.persistent=false;return false;}}
 begin(action){if(!validAction(action)||this.current)return false;this.current=structuredClone(action);this.lastError=null;this.save();return true;}
 acknowledge(id){if(!this.current||this.current.actionId!==id)return false;this.current=null;this.lastError=null;this.save();return true;}
 reject(id){if(!this.current||this.current.actionId!==id)return false;this.discard();return true;}
 discard(){this.current=null;this.lastError=null;this.save();}
 retry(sendAction){if(!this.current)return false;this.lastError=null;return !!sendAction(structuredClone(this.current));}
}
