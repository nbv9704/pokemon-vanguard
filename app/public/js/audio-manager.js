import {BATTLE_AUDIO_EVENT} from './ui/events.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const HASH_SEED=2166136261;
const TYPE_TONES={
 normal:{frequency:430,type:'square',slide:55},fire:{frequency:310,type:'sawtooth',slide:210},water:{frequency:390,type:'sine',slide:-70},electric:{frequency:660,type:'square',slide:260},grass:{frequency:460,type:'triangle',slide:120},ice:{frequency:720,type:'sine',slide:-160},fighting:{frequency:250,type:'square',slide:-70},poison:{frequency:330,type:'sawtooth',slide:-110},ground:{frequency:170,type:'triangle',slide:-45},flying:{frequency:590,type:'sine',slide:170},psychic:{frequency:540,type:'sine',slide:240},bug:{frequency:370,type:'square',slide:95},rock:{frequency:190,type:'square',slide:-35},ghost:{frequency:280,type:'sine',slide:-130},dragon:{frequency:360,type:'sawtooth',slide:310},dark:{frequency:220,type:'triangle',slide:-80},steel:{frequency:510,type:'square',slide:-35},fairy:{frequency:620,type:'sine',slide:180}
};
function moveTone(key){
 const parts=String(key).split(':'),signature=parts[0]==='move-signature',type=signature?parts[2]:parts[1],stage=signature?parts[3]:parts[2],base=TYPE_TONES[type]||TYPE_TONES.normal,impact=stage==='impact';
 return {frequency:Math.max(80,base.frequency+(signature?45:0)+(impact?-35:0)),duration:signature?(impact?.11:.085):(impact?.075:.052),gain:signature?(impact?.052:.034):(impact?.042:.024),type:base.type,slide:base.slide*(impact?-.45:1)};
}

function hash(text){let h=HASH_SEED;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export class AudioManager{
 constructor({settings,onSettingsChange=()=>{}}={}){this.settings=settings||{};this.onSettingsChange=onSettingsChange;this.ctx=null;this.master=null;this.bound=false;}
 enabled(){return this.settings.audio!==false;}
 volume(){return clamp(Number(this.settings.audioVolume??0.55),0,1);}
 async unlock(){if(!this.enabled())return false;const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Ctx)return false;if(!this.ctx){this.ctx=new Ctx();this.master=this.ctx.createGain();this.master.gain.value=this.volume();this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')await this.ctx.resume();return true;}
 sync(){if(this.master)this.master.gain.value=this.enabled()?this.volume():0;this.onSettingsChange(this.settings);}
 setEnabled(value){this.settings.audio=!!value;this.sync();}
 setVolume(value){this.settings.audioVolume=clamp(Number(value),0,1);this.sync();}
 async tone({frequency=440,duration=.07,gain=.05,type='square',slide=0}={}){if(!await this.unlock())return;const now=this.ctx.currentTime,osc=this.ctx.createOscillator(),amp=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,now);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,frequency+slide),now+duration);amp.gain.setValueAtTime(0.0001,now);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),now+.008);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(amp);amp.connect(this.master);osc.start(now);osc.stop(now+duration+.02);}
 ui(kind='confirm'){if(!this.enabled())return;const spec={cursor:[520,.035,.025,'square',40],confirm:[700,.055,.035,'square',160],cancel:[260,.07,.035,'triangle',-60],invalid:[150,.09,.04,'sawtooth',-25]}[kind]||[520,.04,.025,'square',0];void this.tone({frequency:spec[0],duration:spec[1],gain:spec[2],type:spec[3],slide:spec[4]});}
 semantic(sound=''){if(!this.enabled())return;const key=String(sound);if(key.includes('mega-evolution')){void this.tone({frequency:330,duration:.24,gain:.05,type:'sawtooth',slide:660});return;}if(key.includes('faint')){void this.tone({frequency:300,duration:.22,gain:.045,type:'triangle',slide:-180});return;}if(key.includes('switch')||key.includes('form')){void this.tone({frequency:430,duration:.11,gain:.035,type:'triangle',slide:180});return;}if(key.startsWith('move:')||key.startsWith('move-signature:')){void this.tone(moveTone(key));return;}const h=hash(key),frequency=220+(h%420),impact=key.includes('impact')||key.includes('break');void this.tone({frequency,duration:impact?.08:.055,gain:impact?.045:.025,type:impact?'square':'triangle',slide:impact?-80:40});}
 attachDocument(doc=document){if(this.bound)return;this.bound=true;doc.addEventListener('pointerdown',()=>{void this.unlock();},{once:true,capture:true});doc.addEventListener('keydown',()=>{void this.unlock();},{once:true,capture:true});doc.addEventListener('focusin',event=>{if(event.target?.matches?.('[data-ui-focusable]'))this.ui('cursor');});doc.addEventListener('click',event=>{const button=event.target?.closest?.('button:not(:disabled)');if(button)this.ui('confirm');});doc.addEventListener(BATTLE_AUDIO_EVENT,event=>this.semantic(event.detail?.sound||event.detail?.primitive||'battle'));}
}
