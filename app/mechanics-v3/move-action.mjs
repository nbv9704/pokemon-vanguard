import {dispatchHook} from './registry.mjs';
import {tryBeforeMoveConditions} from './before-action.mjs';
import {recordLastMove} from './move-history.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function createMoveActionHandler({moves,manifests,registry,beforeAction=tryBeforeMoveConditions}){
 return function resolveMove(battle,action,runtime){
  const move=byId(moves,action.moveId),mechanics=manifests?.[action.moveId];
  if(!move||!mechanics)throw new Error(`unsupported move: ${action.moveId}`);
  const evidence=mechanics.testEvidence?.[battle.format];if(!Array.isArray(evidence)||!evidence.length)throw new Error(`move lacks ${battle.format} test evidence: ${action.moveId}`);
  const gate=beforeAction?.(battle,action,runtime,move)||{cancelled:false,battle,events:[]};
  if(gate.cancelled)return {battle:gate.battle,events:gate.events};
  const started={kind:'moveStarted',actorId:action.actorId,moveId:action.moveId};
  const tried=dispatchHook(registry,{hook:'onTryMove',battle:gate.battle,invocations:mechanics.handlers,payload:{action,move,mechanics},runtime});
  if(tried.payload.cancelled)return {battle:tried.battle,events:[started,...tried.events]};
  const result=dispatchHook(registry,{hook:'onMove',battle:tried.battle,invocations:mechanics.handlers,payload:tried.payload,runtime});
  return {battle:recordLastMove(result.battle,action.actorId,move.id),events:[...gate.events,started,...tried.events,...result.events]};
 };
}
