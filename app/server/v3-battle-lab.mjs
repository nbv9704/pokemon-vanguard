import {effectiveTargetMode,legalTargets} from '../rules-v3/index.mjs';
import {applyV3BattleAction} from './v3-battle-actions.mjs';
import {validateV3Team} from './v3-progression.mjs';

const clone=value=>structuredClone(value);

function normalizeSpeciesIds(catalog,requested=[]){
 const ids=[],seen=new Set();
 for(const id of [...requested,...catalog.species.map(entry=>entry.id)])if(catalog.speciesById[id]&&!catalog.speciesById[id].isMega&&!seen.has(id)){seen.add(id);ids.push(id);if(ids.length===6)break;}
 if(ids.length!==6)throw new Error(`Battle Lab requires six unique non-Mega species, got ${ids.length}`);
 return ids;
}

export function createBattleLabProgression(catalog,{speciesIds=[]}={}){
 const ids=normalizeSpeciesIds(catalog,speciesIds),mons=[],builds=[],labItems=catalog.items.filter(entry=>entry.enabledForBattle&&!String(entry.id).endsWith('ite')).slice(0,6);
 if(labItems.length<6)throw new Error('Battle Lab requires six distinct enabled held items');
 ids.forEach((speciesId,index)=>{
  const species=catalog.speciesById[speciesId],defaults=species.defaultBuild,monId=`lab-mon-${index}-${speciesId}`,buildId=`lab-build-${index}-${speciesId}`;
  mons.push({monId,speciesId,ownership:'permanent'});
  builds.push({buildId,monId,name:`Lab ${species.name}`,natureId:defaults.natureId,statPoints:clone(defaults.statPoints),moveIds:[...defaults.moveIds],abilityId:defaults.abilityId,itemId:labItems[index].id,revision:1});
 });
 const team={teamId:'lab-team',name:'Battle Lab',buildIds:builds.map(entry=>entry.buildId),revision:1},progression={schemaVersion:1,catalogVersion:catalog.metadata.catalogVersion,revision:1,mons,builds,teams:[team],nextMonSerial:1,nextBuildSerial:1};
 const problems=validateV3Team(team,progression,catalog);if(problems.length)throw new Error(`Battle Lab team invalid: ${problems.join(', ')}`);
 return progression;
}

export function createBattleLabState(catalog,{mode='single',speciesIds=[],seed=100}={}){
 let state={schemaVersion:3,seed,progressionV3:createBattleLabProgression(catalog,{speciesIds})};
 let result=applyV3BattleAction(state,{type:'battleV3.preview.start',mode,difficulty:'normal'},catalog);if(!result.ok)throw new Error(`Battle Lab preview failed: ${result.code}`);state=result.state;
 const count=catalog.regulations[0].pick[mode],buildIds=state.battleV3.playerRoster.slice(0,count).map(entry=>entry.buildId);
 result=applyV3BattleAction(state,{type:'battleV3.preview.lock',buildIds},catalog);if(!result.ok)throw new Error(`Battle Lab lock failed: ${result.code}`);
 return result.state;
}

export function battleLabCommands(battle,catalog,side='A'){
 return battle.sides[side].active.map(actorId=>{
  const unit=battle.sides[side].roster.find(entry=>entry.actorId===actorId);
  for(const moveId of unit.buildSnapshot.moveIds){
   const move=catalog.movesById[moveId];if(!move?.enabledForBattle||(unit.pp[moveId]||0)<=0)continue;
   if(move.mechanics?.handlers?.some(handler=>['apply-pivot-switch','apply-shed-tail','apply-baton-pass','apply-parting-shot-switch'].includes(handler.id)))continue;
   const targetMode=effectiveTargetMode(battle,{actorId,mechanics:move.mechanics}),targets=legalTargets(battle,{side,actorId,targetMode});if(!targets.length)continue;
   const command={kind:'move',actorId,moveId};
   if(!['self','allAdjacentFoes','allAdjacent','userSide','foeSide','field'].includes(targetMode)){const target=targets[0];command.target={side:target.side,slot:target.slot};}
   return command;
  }
  throw new Error(`Battle Lab found no usable move for ${actorId}`);
 });
}

export function stepBattleLab(state,catalog){
 const battle=state?.battleV3?.battle;if(!battle)throw new Error('Battle Lab state has no battle');
 if(battle.phase!=='COMMAND')return {ok:true,state,skipped:true,phase:battle.phase};
 return applyV3BattleAction(state,{type:'battleV3.commands',phaseRevision:battle.phaseRevision,commands:battleLabCommands(battle,catalog,'A')},catalog);
}
