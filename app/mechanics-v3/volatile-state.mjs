import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {VOLATILE_STATUS_IDS} from './manifest-contract.mjs';

function initialVolatileState(volatile,moveId,runtime,source){
 const state={id:volatile,sourceId:moveId};
 if(volatile==='confusion'){
  if(typeof runtime?.nextRandom!=='function')throw new Error('confusion application requires seeded nextRandom');
  state.timer=2+Math.floor(runtime.nextRandom()*4);
 }
 if(volatile==='flinch')state.timer=1;
 if(volatile==='taunt'||volatile==='encore')state.endTurnTimer=runtime?.hasActed?.(runtime.targetId)?4:3;
 if(volatile==='disable')state.endTurnTimer=runtime?.hasActed?.(runtime.targetId)?5:4;
 if(volatile==='leech-seed'){state.sourceSide=source.side;state.sourceSlot=source.slot;}
 return state;
}

const encoreBlockedMoves=new Set(['encore','mimic','mirror-move','sketch','struggle','transform']);

function bindingFailure(volatile,target){
 if(!['encore','disable'].includes(volatile))return null;
 const moveId=target.lastMoveId;
 if(!moveId)return 'noLastMove';
 if(moveId==='struggle'||volatile==='encore'&&encoreBlockedMoves.has(moveId))return 'invalidLastMove';
 if(!Number.isInteger(target.pp?.[moveId])||target.pp[moveId]<=0)return 'noLastMovePP';
 return null;
}

export function applyVolatileStatus(battle,{actorId,targetId,moveId,volatile},runtime={}){
 if(!VOLATILE_STATUS_IDS.includes(volatile))throw new Error(`unsupported volatile status: ${volatile}`);
 const next=clone(battle),target=unitById(next,targetId);
 if(!target||target.hp<=0)return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'targetUnavailable'}]};
 target.volatiles=target.volatiles||{};
 if(volatile==='leech-seed'&&(target.types||[]).includes('grass'))return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'typeImmune'}]};
 if(target.volatiles[volatile])return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'alreadyVolatile'}]};
 const reason=bindingFailure(volatile,target);
 if(reason)return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason}]};
 const source=['A','B'].flatMap(side=>activeUnits(next,side)).find(entry=>entry.actorId===actorId);
 if(!source)return {battle:next,events:[{kind:'volatileFailed',actorId,targetId,moveId,volatile,reason:'sourceUnavailable'}]};
 const state=initialVolatileState(volatile,moveId,{...runtime,targetId},source);
 if(volatile==='encore'||volatile==='disable')state.moveId=target.lastMoveId;
 if(volatile==='encore')state.endsWhenMoveHasNoPp=true;
 target.volatiles[volatile]=state;
 return {battle:next,events:[{kind:'volatileApplied',actorId,targetId,moveId,volatile}]};
}
