function V2_entryAbility(battle,side,monId){
 const mon=V2_monById(battle,monId),ability=mon.buildSnapshot.abilityId,weather={dawnbringer:'sun',raincaller:'rain',snowglobe:'snow',sandstream:'sand'},terrain={'wild-growth':'meadow','static-field':'storm'};
 if(weather[ability])return V2_setField(battle,'weather',weather[ability],monId);if(terrain[ability])return V2_setField(battle,'terrain',terrain[ability],monId);
 const next=V2_clone(battle),source=V2_monById(next,monId),events=[];
 if(ability==='clean-entry'&&source.status){const old=source.status?.id||source.status;source.status=null;events.push({kind:'abilityTriggered',abilityId:ability,sourceId:monId},{kind:'statusCured',targetId:monId,status:old});}
 if(ability==='intimidator')for(const target of V2_activeEntries(next,side==='A'?'B':'A')){const changed=V2_changeStage(target.mon,'atk',-1);Object.assign(target.mon,changed.mon);if(changed.changed)events.push({kind:'statChanged',targetId:target.mon.battleMonId,stat:'atk',amount:-1});}
 return {battle:next,events};
}
function V2_resolveEntry(battle,entries){
 let rngState=battle.rngState>>>0;const ordered=[];
 for(const entry of entries){const mon=V2_monById(battle,entry.monId),roll=V2_nextRandom(rngState);rngState=roll.state;if(mon)ordered.push({...entry,speed:V2_effectiveStat(mon,'spe',battle,entry.side),tieKey:roll.value});}
 ordered.sort((a,b)=>b.speed-a.speed||b.tieKey-a.tieKey||a.monId.localeCompare(b.monId));let current=V2_clone(battle),events=[];
 for(const entry of ordered){const result=V2_entryAbility(current,entry.side,entry.monId);current=result.battle;events.push(...result.events);}
 current.rngState=rngState;return {battle:current,events,order:ordered.map(entry=>entry.monId)};
}
