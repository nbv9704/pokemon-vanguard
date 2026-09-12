import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function applyProtect(battle,{actorId,moveId},runtime={}){
 const next=clone(battle),actor=unitById(next,actorId);
 if(!actor||actor.hp<=0)return {battle:next,succeeded:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 actor.volatiles??={};const gate=stallGate(actor,runtime);
 if(!gate.succeeded)return {battle:next,succeeded:false,events:[{kind:'protectionFailed',actorId,moveId,counter:gate.counter}]};
 actor.volatiles.protect={id:'protect',sourceId:moveId,endTurnTimer:1};
 return {battle:next,succeeded:true,events:[{kind:'protectionApplied',actorId,moveId,nextSuccessDenominator:actor.volatiles.stall.counter}]};
}

export function applySideGuard(battle,{side,actorId,moveId,guard},runtime={}){
 const next=clone(battle),actor=unitById(next,actorId);
 if(!actor||actor.hp<=0)return {battle:next,succeeded:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 actor.volatiles??={};const gate=stallGate(actor,runtime);
 if(!gate.succeeded)return {battle:next,succeeded:false,events:[{kind:'protectionFailed',actorId,moveId,counter:gate.counter}]};
 next.sides[side].conditions??={};next.sides[side].conditions[guard]={id:guard,sourceId:actorId,endTurnTimer:1};
 return {battle:next,succeeded:true,events:[{kind:'sideProtectionApplied',actorId,side,moveId,guard,nextSuccessDenominator:actor.volatiles.stall.counter}]};
}

export function protectionBlockReason(battle,targetRef,mechanics){
 if(mechanics?.bypassesProtect===true)return null;
 const target=unitById(battle,targetRef.actorId);if(target?.volatiles?.protect)return 'protect';
 const conditions=battle.sides?.[targetRef.side]?.conditions||{};
 if(conditions['wide-guard']&&['allAdjacentFoes','allAdjacent'].includes(mechanics?.targetMode))return 'wide-guard';
 if(conditions['quick-guard']&&(mechanics?.priority||0)>0)return 'quick-guard';
 return null;
}

export function isProtectedTarget(unit,mechanics){return Boolean(unit?.volatiles?.protect)&&mechanics?.bypassesProtect!==true;}

function stallGate(actor,runtime){
 const stall=actor.volatiles.stall;
 if(stall){if(typeof runtime.nextRandom!=='function')throw new Error('consecutive protection requires seeded nextRandom');const counter=stall.counter;if(runtime.nextRandom()>=1/counter){delete actor.volatiles.stall;return {succeeded:false,counter};}stall.counter=Math.min(729,counter*3);stall.endTurnTimer=2;}
 else actor.volatiles.stall={id:'stall',counter:3,endTurnTimer:2};
 return {succeeded:true};
}
