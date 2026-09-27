const resultKey=(kind,id)=>id?`${kind}:${id}`:null;

function completedEntries(state){
 const entries=[];
 if(state?.rankedV1?.status==='finished')entries.push({kind:'ranked',id:state.rankedV1.match?.id||state.rankedV1.battleV3?.id||null});
 if(state?.trainingPvpV1?.status==='finished')entries.push({kind:'training-pvp',id:state.trainingPvpV1.battleV3?.id||state.trainingPvpV1.room?.code||null});
 if(state?.battleV3?.phase==='FINISHED'||state?.battleV3?.snapshot?.phase==='FINISHED')entries.push({kind:'pve',id:state.battleV3.id||state.battleV3.snapshot?.id||null});
 return entries.filter(entry=>entry.id);
}

export class CompletedBattleResults{
 constructor({sendAction=()=>false,createActionId=kind=>kind}){this.sendAction=sendAction;this.createActionId=createActionId;this.suppressed=new Set();this.cleanupInFlight=null;}
 key(kind,id){return resultKey(kind,id);}
 isSuppressed(kind,id){const key=this.key(kind,id);return !!key&&this.suppressed.has(key);}
 isRankedActive(state){const ranked=state?.rankedV1;if(!['preview','battle','finished'].includes(ranked?.status))return false;if(ranked.status!=='finished')return true;return !this.isSuppressed('ranked',ranked.match?.id||ranked.battleV3?.id);}
 isTrainingPvpActive(state){const pvp=state?.trainingPvpV1;if(!['preview','battle','finished'].includes(pvp?.status)||!pvp?.battleV3)return false;if(pvp.status!=='finished')return true;return !this.isSuppressed('training-pvp',pvp.battleV3?.id||pvp.room?.code);}
 isPveVisible(state){const view=state?.battleV3;if(!view)return false;if(view.phase!=='FINISHED'&&view.snapshot?.phase!=='FINISHED')return true;return !this.isSuppressed('pve',view.id||view.snapshot?.id);}
 accept(state,{reentry=false}={}){if(reentry)for(const entry of completedEntries(state)){if(entry.kind==='ranked'&&state?.rankedV1?.recovered)continue;this.suppressed.add(this.key(entry.kind,entry.id));}this.flush(state);}
 dismiss(kind,state){const entries=completedEntries(state),entry=entries.find(candidate=>candidate.kind===kind);if(!entry)return false;for(const completed of entries)this.suppressed.add(this.key(completed.kind,completed.id));this.flush(state);return true;}
 dismissFinished(state){const entries=completedEntries(state);for(const entry of entries)this.suppressed.add(this.key(entry.kind,entry.id));this.flush(state);return entries.length>0;}
 actionFor(entry){if(entry.kind==='ranked')return {type:'rankedV1.dismiss',actionId:this.createActionId('ranked-dismiss')};if(entry.kind==='training-pvp')return {type:'trainingPvpV1.dismiss',actionId:this.createActionId('training-pvp-dismiss')};return {type:'battleV3.dismiss'};}
 flush(state){const current=completedEntries(state),keys=new Set(current.map(entry=>this.key(entry.kind,entry.id)));if(this.cleanupInFlight&&!keys.has(this.cleanupInFlight))this.cleanupInFlight=null;if(this.cleanupInFlight)return false;const candidate=current.find(entry=>this.suppressed.has(this.key(entry.kind,entry.id)));if(!candidate)return false;const key=this.key(candidate.kind,candidate.id);if(!this.sendAction(this.actionFor(candidate)))return false;this.cleanupInFlight=key;return true;}
}
