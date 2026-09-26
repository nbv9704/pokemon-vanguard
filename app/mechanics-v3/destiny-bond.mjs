import {clone,unitById} from '../rules-v3/battle-state.mjs';

export function clearDestinyBondBeforeMove(battle,{actorId,moveId}){
 const next=clone(battle),actor=unitById(next,actorId),state=actor?.volatiles?.['destiny-bond'];if(!state)return {battle:next,events:[]};
 delete actor.volatiles['destiny-bond'];return {battle:next,events:[{kind:'volatileEnded',actorId,volatile:'destiny-bond',reason:'nextMove',moveId,sourceMoveId:state.sourceId}]};
}

export function resolveDestinyBondKo(battle,{attackerId,targetId,moveId}){
 const next=clone(battle),target=unitById(next,targetId),attacker=unitById(next,attackerId),state=target?.volatiles?.['destiny-bond'];
 if(!state||!attacker||attacker.hp<=0||attackerId===targetId||moveId==='future-sight'||moveId==='doom-desire')return {battle:next,triggered:false,events:[]};
 const hpBefore=attacker.hp;attacker.hp=0;delete target.volatiles['destiny-bond'];return {battle:next,triggered:true,events:[{kind:'destinyBondTriggered',actorId:targetId,targetId:attackerId,moveId:state.sourceId,triggerMoveId:moveId},{kind:'damage',actorId:targetId,targetId:attackerId,moveId:state.sourceId,hpBefore,hpAfter:0,amount:hpBefore,source:'destiny-bond'},{kind:'fainted',targetId:attackerId,source:'destiny-bond'}]};
}
