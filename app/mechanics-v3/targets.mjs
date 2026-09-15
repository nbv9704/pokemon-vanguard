import {resolveTargets as resolveRuleTargets} from '../rules-v3/targets.mjs';
import {effectiveBattleSpeed} from './speed.mjs';

const deterministicTie=(left,right)=>left.side.localeCompare(right.side)||left.slot-right.slot||left.actorId.localeCompare(right.actorId);

export function resolveTargets(battle,request,options={}){
 const typeRedirectionOrder=(left,right)=>effectiveBattleSpeed(battle,right.unit)-effectiveBattleSpeed(battle,left.unit)||deterministicTie(left,right);
 return resolveRuleTargets(battle,request,{...options,typeRedirectionOrder});
}
