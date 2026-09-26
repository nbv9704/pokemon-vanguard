import {CANONICAL_TYPES} from '../rules-v3/type-chart.mjs';
import {validatePassiveItemHandler} from './passive-validation/item-handlers.mjs';
import {validatePassiveAbilityCoreHandler} from './passive-validation/ability-core-handlers.mjs';
import {validatePassiveAbilityLifecycleHandler} from './passive-validation/ability-lifecycle-handlers.mjs';

const validators=[validatePassiveItemHandler,validatePassiveAbilityCoreHandler,validatePassiveAbilityLifecycleHandler];

export function validatePassiveHandler(entry){
 for(const validate of validators){const problems=validate(entry);if(problems)return problems;}
 const problems=[],params=entry.params||{};
 if(entry.id==='move-type-by-tag'){
  if(typeof params.tag!=='string'||!params.tag)problems.push('move-type-by-tag requires tag');
  if(!CANONICAL_TYPES.includes(params.type))problems.push('move-type-by-tag requires a canonical type');
  return problems;
 }
 return problems;
}
