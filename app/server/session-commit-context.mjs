import {AsyncLocalStorage} from 'node:async_hooks';

export class SessionCommitContext{
 constructor({authorize=async()=>({active:true})}={}){this.authorize=authorize;this.context=new AsyncLocalStorage();}
 run(session,work){return session?this.context.run(session,work):work();}
 async beforeCommit(){
  const session=this.context.getStore();if(!session)return;
  const status=await this.authorize(session,{fresh:true});
  if(status?.active)return;
  throw Object.assign(new Error('Session became inactive before commit'),{code:status?.reason==='revoked'?'AUTH_REVOKED':'AUTH_EXPIRED'});
 }
}
