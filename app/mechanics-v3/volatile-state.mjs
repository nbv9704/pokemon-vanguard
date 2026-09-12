import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {VOLATILE_STATUS_IDS} from './manifest-contract.mjs';

function initialVolatileState(volatile,moveId,runtime){
 const state={id:volatile,sourceId:moveId};
 if(volatile==='confusion'){
  if(typeof runtime?.nextRandom!=='function')throw new Error('confusion application requires seeded nextRandom');
  state.timer=2+Math.floor(runtime.nextRandom()*4);
 }
 if(volatile==='flinch')state.timer=1;
 return state;
}

export function applyVolatileStatus(battle,{actorId,targetId,moveId,volatile},runtime={}){
 if(!VOLATILE_STATUS_IDS.includes(volatile))throw new Error(`unsupported volatile status: ${volatile}`);
 const next=clone(battle),target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'targetUnavailable'}]};
 target.volatiles=target.volatiles||{};
 if(target.volatiles[volatile])return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'alreadyVolatile'}]};
 target.volatiles[volatile]=initialVolatileState(volatile,moveId,runtime);
 return {battle:next,events:[{kind:'volatileApplied',actorId,targetId,moveId,volatile}]};
}
