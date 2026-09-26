import {clone,unitById} from '../../rules-v3/battle-state.mjs';
import {effectiveTargetMode,legalTargets,resolveTargets} from '../../rules-v3/targets.mjs';

const COPYCAT_BLOCKED=new Set(['assist','baneful-bunker','beak-blast','behemoth-bash','behemoth-blade','belch','bestow','blazing-torque','celebrate','chatter','circle-throw','combat-torque','copycat','counter','covet','destiny-bond','detect','dragon-tail','dynamax-cannon','endure','feint','focus-punch','follow-me','helping-hand','hold-hands','kings-shield','magical-torque','mat-block','me-first','metronome','mimic','mirror-move','nature-power','noxious-torque','protect','rage-powder','roar','shell-trap','sketch','sleep-talk','snatch','spiky-shield','spotlight','struggle','switcheroo','tera-starstorm','thief','transform','trick','whirlwind','wicked-torque']);
const INSTRUCT_BLOCKED=new Set(['assist','beak-blast','belch','bide','blazing-torque','celebrate','chatter','combat-torque','copycat','dynamax-cannon','focus-punch','hold-hands','ice-ball','instruct','kings-shield','magical-torque','me-first','metronome','mimic','mirror-move','nature-power','noxious-torque','obstruct','outrage','petal-dance','rollout','shell-trap','sketch','sleep-talk','struggle','thrash','transform','uproar','wicked-torque']);
const SLEEP_TALK_BLOCKED=new Set(['assist','beak-blast','belch','bide','blazing-torque','celebrate','chatter','combat-torque','copycat','dynamax-cannon','focus-punch','hold-hands','magical-torque','me-first','metronome','mimic','mirror-move','nature-power','noxious-torque','shell-trap','sketch','sleep-talk','struggle','uproar','wicked-torque']);
const fixedTargetMode=mode=>['self','allAdjacentFoes','allAdjacent','userSide','foeSide','field'].includes(mode);
const handlerIds=manifest=>(manifest?.handlers||[]).map(entry=>entry.id);
const isTwoTurn=manifest=>handlerIds(manifest).includes('prepare-two-turn-move');
const isRecharge=manifest=>handlerIds(manifest).includes('apply-recharge');

function chooseTarget(battle,{side,actorId,moveId,preferredTarget=null,strictPreferred=false},runtime){
 const mechanics=runtime.moveManifests?.[moveId];if(!mechanics)return {ok:false,reason:'unsupportedCalledMove'};
 const mode=effectiveTargetMode(battle,{actorId,mechanics});if(fixedTargetMode(mode))return {ok:true,target:undefined};
 let targets;try{targets=legalTargets(battle,{side,actorId,targetMode:mode});}catch{return {ok:false,reason:'noLegalTarget'};}
 if(preferredTarget){const match=targets.find(entry=>entry.side===preferredTarget.side&&entry.slot===preferredTarget.slot);if(match)return {ok:true,target:{side:match.side,slot:match.slot}};if(strictPreferred)return {ok:false,reason:'previousTargetUnavailable'};}
 if(!targets.length)return {ok:false,reason:'noLegalTarget'};
 if(typeof runtime.nextRandom!=='function')throw new Error('called move target selection requires seeded nextRandom');const index=Math.min(targets.length-1,Math.floor(runtime.nextRandom()*targets.length)),target=targets[index];return {ok:true,target:{side:target.side,slot:target.slot}};
}

function executeCalledMove(battle,payload,runtime,{actorId,side,moveId,mode,preferredTarget=null,strictPreferred=false}){
 const move=runtime.moves?.[moveId],manifest=runtime.moveManifests?.[moveId];if(!move||!manifest||manifest.unusable===true)return fail(battle,payload,'calledMoveUnavailable',moveId);
 const target=chooseTarget(battle,{side,actorId,moveId,preferredTarget,strictPreferred},runtime);if(!target.ok)return fail(battle,payload,target.reason,moveId);
 const action={kind:'move',side,actorId,moveId,target:target.target,priority:manifest.priority??0,calledBy:{actorId:payload.action.actorId,moveId:payload.move.id,mode},skipChoiceLock:true,...(mode==='use'?{skipBeforeAction:true,skipPp:true,skipPpReason:'calledMove'}:{})};
 const called=runtime.resolveMove(battle,action,runtime),events=[{kind:'moveCalled',actorId:payload.action.actorId,callerMoveId:payload.move.id,calledActorId:actorId,calledMoveId:moveId,mode},...called.events];
 return {battle:called.battle,payload:{...payload,calledMoveResolved:true,calledMoveId:moveId,calledMoveActorId:actorId},events};
}
function fail(battle,payload,reason,calledMoveId=null){return {battle:clone(battle),payload:{...payload,calledMoveResolved:false},events:[{kind:'moveFailed',actorId:payload.action.actorId,moveId:payload.move.id,reason,...(calledMoveId?{calledMoveId}:{})}]};}

export const callCopycatMoveHandler={
 id:'call-copycat-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const previous=payload.previousBattleLastMove,moveId=previous?.moveId;if(!moveId||COPYCAT_BLOCKED.has(moveId))return fail(battle,payload,moveId?'copycatBlockedMove':'noPreviousMove',moveId);
  return executeCalledMove(battle,payload,runtime,{actorId:payload.action.actorId,side:payload.action.side,moveId,mode:'use'});
 }
};

export const callInstructMoveHandler={
 id:'call-instruct-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const refs=resolveTargets(battle,{side:payload.action.side,actorId:payload.action.actorId,targetMode:payload.mechanics.targetMode,target:payload.action.target},{redirectable:false,move:payload.move}),targetId=refs[0]?.actorId||null,target=targetId&&unitById(battle,targetId),moveId=target?.lastMoveId,manifest=moveId&&runtime.moveManifests?.[moveId];
  if(!target||target.hp<=0)return fail(battle,payload,'targetUnavailable');
  if(!moveId||!manifest)return fail(battle,payload,'noPreviousMove');
  if(INSTRUCT_BLOCKED.has(moveId)||isTwoTurn(manifest)||isRecharge(manifest))return fail(battle,payload,'instructBlockedMove',moveId);
  if(!Number.isInteger(target.pp?.[moveId])||target.pp[moveId]<=0)return fail(battle,payload,'noPP',moveId);
  const side=['A','B'].find(id=>battle.sides?.[id]?.roster?.some(unit=>unit.actorId===targetId));
  return executeCalledMove(battle,payload,runtime,{actorId:targetId,side,moveId,mode:'run',preferredTarget:target.lastMoveTarget||null,strictPreferred:true});
 }
};

export const callSleepTalkMoveHandler={
 id:'call-sleep-talk-move',hooks:['onMove'],
 run({battle,payload,runtime}){
  const actor=unitById(battle,payload.action.actorId),status=actor?.status?.id||actor?.status;if(status!=='sleep')return fail(battle,payload,'userNotAsleep');
  const known=[...(actor?.buildSnapshot?.moveIds||Object.keys(actor?.pp||{}))],eligible=known.filter(id=>{if(id==='sleep-talk'||SLEEP_TALK_BLOCKED.has(id))return false;const manifest=runtime.moveManifests?.[id];return Boolean(runtime.moves?.[id]&&manifest&&manifest.unusable!==true&&!isTwoTurn(manifest));});
  if(!eligible.length)return fail(battle,payload,'noCallableMove');if(typeof runtime.nextRandom!=='function')throw new Error('Sleep Talk requires seeded nextRandom');const moveId=eligible[Math.min(eligible.length-1,Math.floor(runtime.nextRandom()*eligible.length))];
  return executeCalledMove(battle,payload,runtime,{actorId:actor.actorId,side:payload.action.side,moveId,mode:'use'});
 }
};
