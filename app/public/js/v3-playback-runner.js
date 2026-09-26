export class V3PlaybackRunner{
 constructor({waitImpl}={}){this.waitImpl=waitImpl;this.pending=new Set();this.speed=1;this.reduced=false;this.generation=0;}
 configure({speed=1,reduced=false}={}){this.speed=Number(speed)===2?2:1;this.reduced=!!reduced;}
 async wait(duration){
  const ms=this.reduced?0:duration/this.speed;
  if(this.waitImpl)return this.waitImpl(ms);
  if(ms<=0)return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.pending.delete(done);resolve();},timer=setTimeout(done,ms);this.pending.add(done);});
 }
 async playTimeline(duration,cues=[],onCue=()=>{}){
  const generation=this.generation,ordered=[...cues].filter(cue=>Number.isFinite(cue.at)&&cue.at>=0&&cue.at<=duration).sort((a,b)=>a.at-b.at),groups=[];
  for(const cue of ordered){const last=groups.at(-1);if(last?.at===cue.at)last.cues.push(cue);else groups.push({at:cue.at,cues:[cue]});}
  let cursor=0;
  for(const group of groups){await this.wait(group.at-cursor);if(generation!==this.generation)return false;for(const cue of group.cues)onCue(cue);cursor=group.at;}
  await this.wait(Math.max(0,duration-cursor));return generation===this.generation;
 }
 cancel(){this.generation++;for(const done of [...this.pending])done();}
}
