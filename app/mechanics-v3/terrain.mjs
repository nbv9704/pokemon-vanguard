import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {TERRAIN_IDS} from './manifest-contract.mjs';
import {passiveEffectActive} from './passive-effects.mjs';

export {TERRAIN_IDS};

const quakeLikeMoves=new Set(['earthquake','bulldoze','magnitude']);
const terrainTypeBoosts={electric:'electric',grassy:'grass',psychic:'psychic'};
const maxHp=unit=>unit.maxHp??unit.stats?.hp;
const effectFor=(unit,kind,battle)=>(unit?.passiveEffects||[]).find(effect=>passiveEffectActive(effect,battle,unit)&&effect.kind===kind);

export function unitIsGrounded(unit,battle=null){
 if(!unit)return false;
 if(effectFor(unit,'item-grounding',battle))return true;
 if(effectFor(unit,'item-airborne',battle)||effectFor(unit,'grounding-immunity',battle))return false;
 if(unit.volatiles?.['magnet-rise']||unit.volatiles?.telekinesis)return false;
 return !(unit.types||[]).includes('flying');
}

export function applyTerrain(battle,{actorId,moveId,terrain,defaultTurns=5}){
 if(!TERRAIN_IDS.includes(terrain))throw new Error(`unsupported terrain: ${terrain}`);
 const next=clone(battle),actor=unitById(next,actorId),current=next.field?.terrain;
 if(current?.id===terrain)return {battle:next,applied:false,events:[{kind:'moveFailed',actorId,moveId,reason:'terrainAlreadyActive',terrain}]};
 const extension=effectFor(actor,'terrain-duration',next),remaining=extension?.turns||defaultTurns,events=[];
 next.field=next.field||{};
 if(current)events.push({kind:'terrainEnded',terrain:current.id,reason:'replaced'});
 next.field.terrain={id:terrain,remaining,sourceActorId:actorId,sourceMoveId:moveId};
 events.push({kind:'terrainStarted',actorId,moveId,terrain,remaining,...(extension?{sourceItemId:extension.sourceId}:{})});
 return {battle:next,applied:true,events};
}

export function terrainDamageModifiers(battle,attacker,defender,move){
 const terrain=battle.field?.terrain?.id,values=[],applied=[],boostedType=terrainTypeBoosts[terrain];
 if(boostedType===move.type&&unitIsGrounded(attacker,battle)){
  const multiplier=5325/4096;values.push(multiplier);applied.push({sourceKind:'terrain',sourceId:terrain,kind:`grounded-${boostedType}-boost`,multiplier});
 }
 if(terrain==='misty'&&move.type==='dragon'&&unitIsGrounded(defender,battle)){
  const multiplier=.5;values.push(multiplier);applied.push({sourceKind:'terrain',sourceId:'misty',kind:'grounded-dragon-reduction',multiplier});
 }
 return {values,applied,powerModifier:terrain==='grassy'&&unitIsGrounded(defender,battle)&&quakeLikeMoves.has(move.id)?.5:1};
}

export function terrainHealingGroup(battle){
 const changes=[];
 if(battle.field?.terrain?.id!=='grassy')return {id:'terrain-healing',changes};
 for(const side of ['A','B'])for(const {unit} of activeUnits(battle,side)){
  if(!unitIsGrounded(unit,battle)||unit.hp>=maxHp(unit))continue;
  changes.push({actorId:unit.actorId,delta:Math.max(1,Math.floor(maxHp(unit)/16))});
 }
 return {id:'terrain-healing',changes};
}

export function terrainMajorStatusBlockReason(battle,target,status){
 if(!unitIsGrounded(target,battle))return null;
 const terrain=battle.field?.terrain?.id;
 if(terrain==='misty'||(terrain==='electric'&&status==='sleep'))return 'terrainBlocked';
 return null;
}

export function terrainPriorityBlockReason(battle,{actorId,targetRef,mechanics}){
 if(battle.field?.terrain?.id!=='psychic'||(mechanics?.priority||0)<=0.1)return null;
 const target=unitById(battle,targetRef?.actorId);if(!target||!unitIsGrounded(target,battle))return null;
 const actorSide=['A','B'].find(side=>(battle.sides?.[side]?.roster||[]).some(unit=>unit.actorId===actorId));
 if(!actorSide||targetRef?.side===actorSide)return null;
 return 'psychicTerrain';
}

export function terrainVolatileBlockReason(battle,target,volatile){
 return volatile==='confusion'&&battle.field?.terrain?.id==='misty'&&unitIsGrounded(target,battle)?'terrainBlocked':null;
}
