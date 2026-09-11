import {V2_applyReplacements,V2_assertBattleInvariants,V2_projectEvent,V2_resolveTurn,V2_submitCommands,V2_validateReplacements} from '../src/v2-engine.mjs';
import {chooseAiCommands,chooseAiLineup} from './v2-ai.mjs';
import {aiReplacements,battleMon,clone,enterBattle,pickTemplate,projectBattleForAi,projectedSnapshot} from './v2-battle-factory.mjs';
import {v2BattleView} from './v2-battle-view.mjs';
import {getV2Progression} from './v2-progression.mjs';
import {publicPreviewRoster,validatePreviewSelection,validateRosterForRegulation} from './v2-regulations.mjs';

export {projectBattleForAi,v2BattleView};

export function applyV2BattleAction(state,action,catalog){
 const base=clone(state),progression=getV2Progression(base,catalog),session=base.battleV2;
 if(action?.type==='battleV2.preview.start'){
  if(session&&session.phase!=='FINISHED')return {ok:false,code:'BATTLE_ALREADY_ACTIVE'};if(!['easy','normal','hard'].includes(action.difficulty||'normal'))return {ok:false,code:'INVALID_DIFFICULTY'};const mode=action.mode,regulationId=action.regulationId||`alpha-${mode}`,team=progression.teams.find(entry=>entry.teamId===(action.teamId||progression.activeTeamId));if(!team)return {ok:false,code:'TEAM_NOT_FOUND'};
  const valid=validateRosterForRegulation(team,progression,catalog,regulationId,mode);if(!valid.ok)return valid;base.battleV2Serial=(base.battleV2Serial||0)+1;const template=pickTemplate(catalog,action,base.battleV2Serial-1),playerRoster=publicPreviewRoster(team,progression,catalog);
  base.battleV2={id:`v2-${base.battleV2Serial}`,phase:'PREVIEW',mode,regulationId,teamId:team.teamId,difficulty:action.difficulty||template.difficulty,gym:Number.isInteger(action.gym)?action.gym:null,playerRoster,opponentRoster:template.speciesIds.map(id=>{const species=catalog.speciesById[id];return {speciesId:id,name:species.name,types:species.types,artId:species.artId};}),templateId:template.id,aiRngState:(base.seed^base.battleV2Serial^0xa17e)>>>0};return {ok:true,state:base};
 }
 if(!session)return {ok:false,code:'NO_V2_BATTLE'};
 if(action.type==='battleV2.preview.lock'){
  if(session.phase!=='PREVIEW')return {ok:false,code:'WRONG_PHASE'};const team=progression.teams.find(entry=>entry.teamId===session.teamId),valid=validatePreviewSelection(action.buildIds,team,progression,catalog,session.regulationId,session.mode);if(!valid.ok)return valid;
  const template=(catalog.aiTeams.exhibition.find(entry=>entry.id===session.templateId)||catalog.aiTeams.gyms[session.mode].find(entry=>entry.id===session.templateId)),enemyIds=chooseAiLineup(template,session.mode,session.playerRoster,catalog),playerBuilds=action.buildIds.map(id=>progression.builds.find(build=>build.buildId===id)),enemyBuilds=enemyIds.map(id=>clone(catalog.speciesById[id].defaultBuild));
  const activeCount=session.mode==='double'?2:1,battle={id:session.id,phase:'ENTRY',phaseRevision:1,turn:1,activeCount,rngState:(base.seed^base.battleV2Serial)>>>0,eventSequence:0,events:[],result:null,rewardReceipts:[],pending:{},queue:[],field:{weather:null,terrain:null,sides:{A:{tailwind:0,barrier:0},B:{tailwind:0,barrier:0}}},sides:{A:{roster:playerBuilds.map((build,index)=>{const mon=progression.mons.find(entry=>entry.monId===build.monId);return battleMon('A',index,build,catalog.speciesById[mon.speciesId],catalog);}),active:[]},B:{roster:enemyBuilds.map((build,index)=>battleMon('B',index,build,catalog.speciesById[enemyIds[index]],catalog)),active:[]}}};battle.sides.A.active=battle.sides.A.roster.slice(0,activeCount).map(mon=>mon.battleMonId);battle.sides.B.active=battle.sides.B.roster.slice(0,activeCount).map(mon=>mon.battleMonId);
  const entered=enterBattle(battle,[]);V2_assertBattleInvariants(entered.battle);base.battleV2={...session,phase:entered.battle.phase,battle:entered.battle,lastTurn:{initial:projectedSnapshot(battle,catalog),events:entered.events,final:projectedSnapshot(entered.battle,catalog)}};return {ok:true,state:base};
 }
 if(action.type==='battleV2.commands'){
  const battle=session.battle;if(session.phase!=='COMMAND'||battle.phase!=='COMMAND'||action.phaseRevision!==battle.phaseRevision)return {ok:false,code:'STALE_PHASE'};const first=V2_submitCommands(battle,'A',action.commands,catalog.movesById);if(!first.ok)return first;const ai=chooseAiCommands(projectBattleForAi(first.battle,catalog),{side:'B',difficulty:session.difficulty,moves:catalog.movesById,aiRngState:session.aiRngState}),second=V2_submitCommands(first.battle,'B',ai.commands,catalog.movesById);if(!second.ok)return second;const initial=projectedSnapshot(battle,catalog),resolved=V2_resolveTurn(second.battle,catalog.movesById);if(!resolved.ok)return resolved;V2_assertBattleInvariants(resolved.battle);base.battleV2={...session,phase:resolved.battle.phase,battle:resolved.battle,aiRngState:ai.aiRngState,lastTurn:{initial,events:resolved.events.map(event=>V2_projectEvent(event,resolved.battle,'A')),final:projectedSnapshot(resolved.battle,catalog)}};return {ok:true,state:base};
 }
 if(action.type==='battleV2.replacements'){
  const battle=session.battle;if(session.phase!=='REPLACE'||battle.phase!=='REPLACE'||action.phaseRevision!==battle.phaseRevision)return {ok:false,code:'STALE_PHASE'};const valid=V2_validateReplacements(battle,'A',action.replacements);if(!valid.ok)return valid;const initial=projectedSnapshot(battle,catalog),applied=V2_applyReplacements(battle,{A:valid.replacements,B:aiReplacements(battle)});if(!applied.ok)return applied;const entered=enterBattle(applied.battle,applied.events);V2_assertBattleInvariants(entered.battle);base.battleV2={...session,phase:entered.battle.phase,battle:entered.battle,lastTurn:{initial,events:entered.events,final:projectedSnapshot(entered.battle,catalog)}};return {ok:true,state:base};
 }
 if(action.type==='battleV2.surrender'){if(session.phase==='FINISHED')return {ok:false,code:'WRONG_PHASE'};const battle=clone(session.battle);if(battle){battle.phase='FINISHED';battle.phaseRevision++;battle.result={winner:'B',reason:'surrender',turn:battle.turn,receiptId:`${battle.id}:surrender`};}base.battleV2={...session,phase:'FINISHED',battle};return {ok:true,state:base};}
 return {ok:false,code:'UNKNOWN_V2_BATTLE_ACTION'};
}
