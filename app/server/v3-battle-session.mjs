export function reconcileV3BattleAfterTeamSave(state,teamId){
 const session=state?.battleV3;
 if(!session||session.teamId!==teamId||!['PREVIEW','FINISHED'].includes(session.phase))return state;
 return {...state,battleV3:null};
}

function reconcileIdentity(value,catalog){
 if(!value?.speciesId)return false;
 const species=catalog?.speciesById?.[value.speciesId];
 if(!species?.spriteKey||value.spriteKey===species.spriteKey)return false;
 value.spriteKey=species.spriteKey;
 return true;
}

export function reconcileV3BattlePresentation(state,catalog){
 const session=state?.battleV3;
 if(!session||session.phase==='PREVIEW'||!session.battle)return {state,changed:false};
 const next=structuredClone(state),current=next.battleV3;
 let changed=false;
 for(const side of ['A','B'])for(const unit of current.battle.sides?.[side]?.roster||[])changed=reconcileIdentity(unit,catalog)||changed;
 for(const key of ['initial','final'])for(const side of ['own','opponent'])for(const unit of current.lastTurn?.[key]?.[side]||[])changed=reconcileIdentity(unit,catalog)||changed;
 const reconcileEvent=event=>{
  const speciesId=event.toSpeciesId||event.speciesId;
  const spriteKey=speciesId&&catalog?.speciesById?.[speciesId]?.spriteKey;
  if(!spriteKey||event.spriteKey===spriteKey)return;
  event.spriteKey=spriteKey;changed=true;
 };
 for(const event of current.lastEvents||[])reconcileEvent(event);
 for(const event of current.battle.events||[])reconcileEvent(event);
 return {state:changed?next:state,changed};
}
