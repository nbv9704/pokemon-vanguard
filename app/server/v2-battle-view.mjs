import {V2_logPage,V2_projectEvent} from '../src/v2-engine.mjs';
import {clone,namesFor,projectedSnapshot} from './v2-battle-factory.mjs';

export function v2BattleView(state,catalog){
 const session=state.battleV2;
 if(!session)return null;
 if(session.phase==='PREVIEW')return clone({id:session.id,phase:session.phase,mode:session.mode,regulationId:session.regulationId,teamId:session.teamId,difficulty:session.difficulty,gym:session.gym,playerRoster:session.playerRoster,opponentRoster:session.opponentRoster});
 const battle=session.battle,names=namesFor(battle,catalog),projectedEvents=(battle.events||[]).map(event=>V2_projectEvent(event,battle,'A'));
 return {id:session.id,phase:battle.phase,mode:session.mode,regulationId:session.regulationId,difficulty:session.difficulty,gym:session.gym,snapshot:projectedSnapshot(battle,catalog),turnSnapshots:clone(session.lastTurn?{initial:session.lastTurn.initial,final:session.lastTurn.final}:null),events:clone(session.lastTurn?.events||[]),log:V2_logPage(projectedEvents,0,20,names),moves:catalog.moves,opponentRoster:session.opponentRoster};
}
