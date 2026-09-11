import {dispatchHook} from './registry.mjs';

const byId=(catalog,id)=>Array.isArray(catalog)?catalog.find(entry=>entry.id===id):catalog?.[id];

export function createMoveActionHandler({moves,manifests,registry}){
 return function resolveMove(battle,action,runtime){
  const move=byId(moves,action.moveId),mechanics=manifests?.[action.moveId];
  if(!move||!mechanics)throw new Error(`unsupported move: ${action.moveId}`);
  const evidence=mechanics.testEvidence?.[battle.format];if(!Array.isArray(evidence)||!evidence.length)throw new Error(`move lacks ${battle.format} test evidence: ${action.moveId}`);
  const started={kind:'moveStarted',actorId:action.actorId,moveId:action.moveId};
  const tried=dispatchHook(registry,{hook:'onTryMove',battle,invocations:mechanics.handlers,payload:{action,move,mechanics},runtime});
  if(tried.payload.cancelled)return {battle:tried.battle,events:[started,...tried.events]};
  const result=dispatchHook(registry,{hook:'onMove',battle:tried.battle,invocations:mechanics.handlers,payload:tried.payload,runtime});
  return {battle:result.battle,events:[started,...tried.events,...result.events]};
 };
}
