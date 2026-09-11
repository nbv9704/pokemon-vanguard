import {clone} from '../rules-v3/battle-state.mjs';
import {HOOKS} from './manifest-contract.mjs';

export function createHookRegistry(definitions=[]){
 const handlers=new Map();
 for(const definition of definitions){
  if(!definition?.id||handlers.has(definition.id)||typeof definition.run!=='function')throw new Error(`invalid or duplicate handler: ${definition?.id||'?'}`);
  if(!Array.isArray(definition.hooks)||!definition.hooks.length||definition.hooks.some(hook=>!HOOKS.includes(hook)))throw new Error(`invalid hooks for handler: ${definition.id}`);
  handlers.set(definition.id,{...definition,hooks:[...definition.hooks]});
 }
 return Object.freeze({
  has:id=>handlers.has(id),
  ids:()=>[...handlers.keys()].sort(),
  get:id=>handlers.get(id)
 });
}

export function dispatchHook(registry,{hook,battle,invocations,payload={},runtime={}}){
 if(!HOOKS.includes(hook))throw new Error(`unknown hook: ${hook}`);
 const ordered=(invocations||[]).filter(entry=>entry.hook===hook).map((entry,index)=>({...entry,index})).sort((left,right)=>left.order-right.order||left.id.localeCompare(right.id)||left.index-right.index);
 let currentBattle=clone(battle),currentPayload=clone(payload);const events=[],trace=[];
 for(const invocation of ordered){
  const handler=registry.get(invocation.id);
  if(!handler||!handler.hooks.includes(hook))throw new Error(`unregistered handler ${invocation.id} for ${hook}`);
  const battleInput=clone(currentBattle),payloadInput=clone(currentPayload),beforeBattle=JSON.stringify(battleInput),beforePayload=JSON.stringify(payloadInput);
  const result=handler.run({battle:battleInput,payload:payloadInput,params:clone(invocation.params||{}),runtime});
  if(JSON.stringify(battleInput)!==beforeBattle||JSON.stringify(payloadInput)!==beforePayload)throw new Error(`handler mutated its input: ${invocation.id}`);
  if(!result?.battle||!result?.payload||!Array.isArray(result.events))throw new Error(`invalid handler result: ${invocation.id}`);
  currentBattle=clone(result.battle);currentPayload=clone(result.payload);events.push(...clone(result.events));trace.push({hook,id:invocation.id,order:invocation.order});
 }
 return {battle:currentBattle,payload:currentPayload,events,trace};
}
