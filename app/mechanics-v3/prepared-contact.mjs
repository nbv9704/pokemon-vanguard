import {clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyMajorStatus} from './major-status.mjs';

export function resolvePreparedContactResponse(battle,{attackerId,targetId,moveId,mechanics},runtime={}){
 let next=clone(battle);const attacker=unitById(next,attackerId),target=unitById(next,targetId),events=[];
 if(!attacker||attacker.hp<=0||!target||mechanics?.contact!==true)return {battle:next,events};
 const prepared=Object.values(target.volatiles||{}).find(state=>state?.contactBurn===true);
 if(!prepared)return {battle:next,events};
 const applied=applyMajorStatus(next,{actorId:target.actorId,targetId:attacker.actorId,moveId:prepared.sourceId||moveId,status:'burn'},runtime);next=applied.battle;events.push({kind:'preparedContactTriggered',sourceId:target.actorId,targetId:attacker.actorId,sourceMoveId:prepared.sourceId||null,moveId},...applied.events);return {battle:next,events};
}
