import {createMovePresentationPlan} from './move-presentation.js';
import {mergeSpecialBattlePresentation} from './special-battle-presentation.js';

export class BattlePresentationRuntime{
 constructor({onAudio=()=>{},onCue=()=>{}}={}){this.onAudio=onAudio;this.onCue=onCue;}
 plan(frame,catalog){return mergeSpecialBattlePresentation(createMovePresentationPlan(frame,catalog),frame);}
 dispatch(cue,context={}){if(!cue)return;const payload={...cue,...context};this.onCue(payload);if(cue.type==='audio')this.onAudio(payload);}
 hookCues(plan){return (plan?.cues||[]).filter(cue=>cue.type==='audio'||cue.type==='commit');}
 actorCue(plan,role,targetIndex){return (plan?.cues||[]).find(cue=>cue.type==='actor'&&cue.role===role&&(targetIndex===undefined||cue.targetIndex===targetIndex));}
 cameraCues(plan){return (plan?.cues||[]).filter(cue=>cue.type==='camera'||cue.type==='screen');}
}
