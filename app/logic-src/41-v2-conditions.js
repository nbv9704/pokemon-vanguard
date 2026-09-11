function V2_fieldDuration(mon,kind){return kind==='weather'&&mon.buildSnapshot.itemId==='weather-rock'||kind==='terrain'&&mon.buildSnapshot.itemId==='terrain-root'?7:5;}
function V2_setField(battle,kind,id,source){const next=V2_clone(battle),mon=V2_monById(next,source),remaining=V2_fieldDuration(mon,kind);next.field[kind]={id,remaining};return {battle:next,events:[{kind:'fieldChanged',field:kind,value:id,remaining,sourceId:source}]};}
function V2_setSideCondition(battle,side,id,remaining){const next=V2_clone(battle);next.field.sides[side][id]=remaining;return {battle:next,events:[{kind:'fieldChanged',field:'side',side,value:id,remaining}]};}
function V2_statusImmunity(mon,status){return status==='burn'&&mon.types.includes('Flame')||status==='poison'&&(mon.types.includes('Venom')||mon.types.includes('Steel'));}
function V2_applyStatus(mon,status,{fromFoe=true}={}){
 if(mon.hp<=0||mon.status||V2_statusImmunity(mon,status))return {applied:false,mon,events:[]};
 const next=V2_clone(mon);next.status=status==='sleep'?{id:'sleep',remainingActions:2}:status;
 const events=[{kind:'statusApplied',targetId:mon.battleMonId,status}];
 if(next.buildSnapshot.itemId==='cure-berry'&&!next.itemState.used){next.status=null;next.itemState.used=true;events.push({kind:'itemTriggered',sourceId:mon.battleMonId,itemId:'cure-berry'},{kind:'statusCured',targetId:mon.battleMonId,status});}
 return {applied:true,mon:next,events};
}
function V2_changeStage(mon,stat,amount,{fromFoe=true}={}){
 if(amount<0&&fromFoe&&(mon.buildSnapshot.abilityId==='steady-body'||mon.buildSnapshot.itemId==='clear-charm'))return {changed:false,mon};
 const next=V2_clone(mon),before=next.stages[stat]||0;next.stages[stat]=Math.max(-6,Math.min(6,before+amount));return {changed:next.stages[stat]!==before,mon:next};
}
function V2_sleepGate(mon){
 if(mon.status?.id!=='sleep')return {canAct:true,mon};
 const next=V2_clone(mon);if(next.status.remainingActions>0){next.status.remainingActions--;return {canAct:false,mon:next};}next.status=null;return {canAct:true,mon:next,woke:true};
}
function V2_guardAttempt(mon,rngState){
 const chain=mon.volatiles.guardChain||0,denominator=Math.min(81,3**chain),roll=V2_nextRandom(rngState),success=roll.value<1/denominator,next=V2_clone(mon);next.volatiles.guardChain=Math.min(4,chain+1);next.volatiles.guarded=success;return {success,mon:next,rngState:roll.state,denominator};
}
function V2_resetGuard(mon){const next=V2_clone(mon);next.volatiles.guardChain=0;next.volatiles.guarded=false;return next;}
