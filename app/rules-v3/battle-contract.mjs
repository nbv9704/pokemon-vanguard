import {clone} from './battle-state.mjs';

export const BATTLE_PHASES=['ENTRY','COMMAND','RESOLVE','END_TURN','REPLACE','FINISHED'];
export const FORMAT_ACTIVE_COUNT={single:1,double:2};

export function validateBattleSnapshot(battle){
 const problems=[];
 if(!battle||typeof battle!=='object')return ['battle must be an object'];
 if(typeof battle.id!=='string'||!battle.id)problems.push('battle id is required');
 if(typeof battle.rulesVersion!=='string'||!battle.rulesVersion)problems.push('rulesVersion is required');
 if(typeof battle.catalogVersion!=='string'||!battle.catalogVersion)problems.push('catalogVersion is required');
 if(!Object.hasOwn(FORMAT_ACTIVE_COUNT,battle.format)||battle.activeCount!==FORMAT_ACTIVE_COUNT[battle.format])problems.push('format and activeCount disagree');
 if(!BATTLE_PHASES.includes(battle.phase))problems.push('invalid battle phase');
 if(!Number.isInteger(battle.rngState)||battle.rngState<0||battle.rngState>0xffffffff)problems.push('rngState must be an unsigned 32-bit integer');
 const globalIds=new Set();
 for(const side of ['A','B']){
  const roster=battle.sides?.[side]?.roster,active=battle.sides?.[side]?.active;
  if(!Array.isArray(roster)||!Array.isArray(active)||active.length!==battle.activeCount){problems.push(`${side} has invalid roster or active slots`);continue;}
  const sideIds=new Set();
  for(const unit of roster){
   const limit=unit?.maxHp??unit?.stats?.hp;
   if(typeof unit?.actorId!=='string'||!unit.actorId||sideIds.has(unit.actorId)||globalIds.has(unit.actorId))problems.push(`${side} has an invalid or duplicate actor id`);
   else{sideIds.add(unit.actorId);globalIds.add(unit.actorId);}
   if(!Number.isInteger(unit?.hp)||!Number.isInteger(limit)||limit<1||unit.hp<0||unit.hp>limit)problems.push(`${unit?.actorId||side} has invalid HP`);
  }
  if(new Set(active.filter(Boolean)).size!==active.filter(Boolean).length||active.some(actorId=>actorId&&!sideIds.has(actorId)))problems.push(`${side} has invalid active actors`);
 }
 return problems;
}

export function createBattleSnapshot({id,rulesVersion,catalogVersion,format,seed,sides}){
 const activeCount=FORMAT_ACTIVE_COUNT[format],battle={id,rulesVersion,catalogVersion,format,activeCount,phase:'ENTRY',phaseRevision:1,turn:1,rngState:seed,eventSequence:0,events:[],result:null,sides:clone(sides)};
 const problems=validateBattleSnapshot(battle);if(problems.length)throw new Error(problems.join('; '));
 return battle;
}
