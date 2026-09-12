export function reconcileV3BattleAfterTeamSave(state,teamId){
 const session=state?.battleV3;
 if(!session||session.teamId!==teamId||!['PREVIEW','FINISHED'].includes(session.phase))return state;
 return {...state,battleV3:null};
}
