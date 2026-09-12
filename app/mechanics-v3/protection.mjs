import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status.mjs';

export function applyProtect(battle,{actorId,moveId,retaliation=null,blocksStatus=true},runtime={}){
 const next=clone(battle),actor=unitById(next,actorId);
 if(!actor||actor.hp<=0)return {battle:next,succeeded:false,events:[{kind:'moveFailed',actorId,moveId,reason:'actorUnavailable'}]};
 actor.volatiles??={};const gate=stallGate(actor,runtime);
 if(!gate.succeeded)return {battle:next,succeeded:false,events:[{kind:'protectionFailed',actorId,moveId,counter:gate.counter}]};
 actor.volatiles.protect={id:'protect',sourceId:moveId,retaliation,blocksStatus,endTurnTimer:1};
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

export function protectionBlockReason(battle,targetRef,mechanics,move=null){
 if(mechanics?.bypassesProtect===true)return null;
 const target=unitById(battle,targetRef.actorId),protect=target?.volatiles?.protect;
 if(protect&&(protect.blocksStatus!==false||move?.category!=='status'))return 'protect';
 const conditions=battle.sides?.[targetRef.side]?.conditions||{};
 if(conditions['wide-guard']&&['allAdjacentFoes','allAdjacent'].includes(mechanics?.targetMode))return 'wide-guard';
 if(conditions['quick-guard']&&(mechanics?.priority||0)>0)return 'quick-guard';
 return null;
}

export function resolveProtectionBlock(battle,{targetRef,actorId,move,mechanics},runtime={}){
 const reason=protectionBlockReason(battle,targetRef,mechanics,move);if(!reason)return {battle:clone(battle),blocked:false,events:[]};
 let next=clone(battle);const target=unitById(next,targetRef.actorId),actor=unitById(next,actorId),protect=target?.volatiles?.protect;
 const events=[{kind:'moveBlocked',actorId,targetId:targetRef.actorId,moveId:move.id,reason,protectionId:protect?.sourceId||reason}];
 if(reason!=='protect'||!mechanics.contact||!actor||actor.hp<=0||!protect?.retaliation)return {battle:next,blocked:true,events};
 if(protect.retaliation==='spiky-damage'){
  const hpBefore=actor.hp,amount=Math.min(hpBefore,Math.max(1,Math.floor(actor.maxHp/8)));actor.hp-=amount;
  events.push({kind:'damage',actorId:target.actorId,targetId:actor.actorId,moveId:protect.sourceId,hpBefore,hpAfter:actor.hp,amount,source:'protection'});
  if(actor.hp===0)events.push({kind:'fainted',targetId:actor.actorId,source:protect.sourceId});
 }else if(protect.retaliation==='lower-attack'){
  const before=actor.stages?.atk||0,after=Math.max(-6,before-1);actor.stages??={};actor.stages.atk=after;
  events.push({kind:'statStageChanged',actorId:target.actorId,targetId:actor.actorId,moveId:protect.sourceId,stat:'atk',before,after,requestedDelta:-1,appliedDelta:after-before,reason:after===before?'stageLimit':null});
 }else if(protect.retaliation==='poison'){
  const applied=applyMajorStatus(next,{actorId:target.actorId,targetId:actor.actorId,moveId:protect.sourceId,status:'poison'},runtime);next=applied.battle;events.push(...applied.events);
 }
 return {battle:next,blocked:true,events};
}

export function breakProtection(battle,{targetRefs,actorId,moveId}){
 const next=clone(battle),events=[];
 for(const targetRef of targetRefs){const target=unitById(next,targetRef.actorId);if(!target)continue;const removed=[];
  if(target.volatiles?.protect){delete target.volatiles.protect;removed.push('protect');}
  const conditions=next.sides?.[targetRef.side]?.conditions||{};for(const guard of ['wide-guard','quick-guard'])if(conditions[guard]){delete conditions[guard];removed.push(guard);}
  if(removed.length){delete target.volatiles?.stall;events.push({kind:'protectionBroken',actorId,targetId:target.actorId,moveId,removed});}
 }
 return {battle:next,events};
}

export function isProtectedTarget(unit,mechanics){return Boolean(unit?.volatiles?.protect)&&mechanics?.bypassesProtect!==true;}

function stallGate(actor,runtime){
 const stall=actor.volatiles.stall;
 if(stall){if(typeof runtime.nextRandom!=='function')throw new Error('consecutive protection requires seeded nextRandom');const counter=stall.counter;if(runtime.nextRandom()>=1/counter){delete actor.volatiles.stall;return {succeeded:false,counter};}stall.counter=Math.min(729,counter*3);stall.endTurnTimer=2;}
 else actor.volatiles.stall={id:'stall',counter:3,endTurnTimer:2};
 return {succeeded:true};
}
