export class V3PlaybackRunner{
 constructor({waitImpl}={}){this.waitImpl=waitImpl;this.pending=new Set();this.speed=1;this.reduced=false;}
 configure({speed=1,reduced=false}={}){this.speed=Number(speed)===2?2:1;this.reduced=!!reduced;}
 async wait(duration){
  const ms=this.reduced?0:duration/this.speed;
  if(this.waitImpl)return this.waitImpl(ms);
  if(ms<=0)return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.pending.delete(done);resolve();},timer=setTimeout(done,ms);this.pending.add(done);});
 }
 cancel(){for(const done of [...this.pending])done();}
}
