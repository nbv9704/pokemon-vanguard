const V2_ABILITY_IDS=['dawnbringer','raincaller','wild-growth','static-field','snowglobe','sandstream','tailwind','night-hunter','radiance','venom-touch','ironhide','mind-link','quick-start','keen-focus','sturdy-heart','rain-swimmer','clean-entry','water-shell','sun-runner','thorn-coat','healer','calm-mind','intimidator','steady-body'];
const V2_ITEM_IDS=['vital-seed','power-lens','aegis-plate','swift-feather','cure-berry','focus-crystal','healing-berry','clear-charm','weather-rock','terrain-root','special-lens','physical-band'];
const V2_ABILITY_HOOKS={dawnbringer:'onEntry',raincaller:'onEntry','wild-growth':'onEntry','static-field':'onEntry',snowglobe:'onEntry',sandstream:'onEntry',tailwind:'modifyStat','night-hunter':'modifyOutgoingDamage',radiance:'endTurn','venom-touch':'afterDamage',ironhide:'modifyIncomingDamage','mind-link':'modifyOutgoingDamage','quick-start':'modifyStat','keen-focus':'modifyAccuracy','sturdy-heart':'beforeDamage','rain-swimmer':'modifyStat','clean-entry':'onEntry','water-shell':'modifyIncomingDamage','sun-runner':'modifyStat','thorn-coat':'afterDamage',healer:'endTurn','calm-mind':'modifyStat',intimidator:'onEntry','steady-body':'onStatChange'};
const V2_ITEM_HOOKS={'vital-seed':'endTurn','power-lens':'modifyOutgoingDamage','aegis-plate':'modifyIncomingDamage','swift-feather':'modifyStat','cure-berry':'onStatusApplied','focus-crystal':'beforeDamage','healing-berry':'afterDamage','clear-charm':'onStatChange','weather-rock':'onFieldSet','terrain-root':'onFieldSet','special-lens':'modifyStat','physical-band':'modifyStat'};
function V2_clone(value){return JSON.parse(JSON.stringify(value));}
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
function V2_effectiveStat(mon,stat,battle,side){
 let value=mon.stats[stat]*V2_stageMultiplier(mon.stages?.[stat]);const ability=mon.buildSnapshot.abilityId,item=mon.buildSnapshot.itemId;
 if(stat==='def'&&battle.field.weather?.id==='snow'&&mon.types.includes('Frost'))value*=1.5;
 if(stat==='spe'){
  if(mon.status==='slow')value*=.5;if(battle.field.sides[side]?.tailwind>0)value*=2;
  if(ability==='tailwind')value*=1.3;if(ability==='quick-start'&&mon.hp===mon.stats.hp)value*=1.2;
  if(ability==='rain-swimmer'&&battle.field.weather?.id==='rain')value*=1.5;if(ability==='sun-runner'&&battle.field.weather?.id==='sun')value*=1.5;
  if(item==='swift-feather')value*=1.25;
 }
 if(stat==='spd'&&ability==='calm-mind')value*=1.2;if(stat==='spa'&&item==='special-lens')value*=1.15;if(stat==='atk'&&item==='physical-band')value*=1.15;
 return Math.max(1,Math.floor(value));
}
function V2_damageModifiers({attacker,defender,battle,attackerSide,defenderSide,move,allies=[]}){
 let outgoing=1,incoming=1,accuracy=move.accuracy;
 if(attacker.buildSnapshot.abilityId==='night-hunter'&&defender.hp*2<defender.stats.hp)outgoing*=1.25;
 if(attacker.buildSnapshot.abilityId==='keen-focus')accuracy=Math.min(100,accuracy+5);
 if(attacker.buildSnapshot.itemId==='power-lens')outgoing*=1.2;
 if(allies.some(mon=>mon.hp>0&&mon.battleMonId!==attacker.battleMonId&&mon.buildSnapshot.abilityId==='mind-link'))outgoing*=1.15;
 if(defender.buildSnapshot.abilityId==='ironhide')incoming*=.8;
 if(defender.buildSnapshot.abilityId==='water-shell'&&move.type==='Flame')incoming*=.5;
 if(defender.buildSnapshot.itemId==='aegis-plate')incoming*=.8;
 if(battle.field.sides[defenderSide]?.barrier>0)incoming*=.75;
 return {outgoing,incoming,accuracy};
}
function V2_surviveLethal(mon,damage,{residual=false}={}){
 if(residual||damage<mon.hp||mon.hp!==mon.stats.hp)return {damage,mon,trigger:null};
 const next=V2_clone(mon);
 if(next.buildSnapshot.abilityId==='sturdy-heart'&&!next.volatiles.sturdyUsed){next.volatiles.sturdyUsed=true;return {damage:mon.hp-1,mon:next,trigger:'sturdy-heart'};}
 if(next.buildSnapshot.itemId==='focus-crystal'&&!next.itemState.used){next.itemState.used=true;return {damage:mon.hp-1,mon:next,trigger:'focus-crystal'};}
 return {damage,mon,trigger:null};
}
function V2_afterDamage({attacker,defender,damage,move,rngState,moveTriedPoison=false}){
 let nextAttacker=V2_clone(attacker),nextDefender=V2_clone(defender),state=rngState,events=[];
 if(damage>0&&nextDefender.hp>0&&nextDefender.buildSnapshot.itemId==='healing-berry'&&!nextDefender.itemState.used&&nextDefender.hp*4<=nextDefender.stats.hp){const amount=Math.min(nextDefender.stats.hp-nextDefender.hp,Math.floor(nextDefender.stats.hp/4));nextDefender.hp+=amount;nextDefender.itemState.used=true;events.push({kind:'itemTriggered',itemId:'healing-berry',sourceId:nextDefender.battleMonId},{kind:'heal',targetId:nextDefender.battleMonId,amount});}
 if(damage>0&&nextDefender.hp>0&&nextAttacker.buildSnapshot.abilityId==='venom-touch'&&!moveTriedPoison){const roll=V2_nextRandom(state);state=roll.state;if(roll.value<.3){const applied=V2_applyStatus(nextDefender,'poison');nextDefender=applied.mon;events.push(...applied.events);}}
 if(damage>0&&move.contact&&nextDefender.hp>0&&nextDefender.buildSnapshot.abilityId==='thorn-coat'){const amount=Math.min(nextAttacker.hp,Math.max(1,Math.floor(nextAttacker.stats.hp/16)));nextAttacker.hp-=amount;events.push({kind:'abilityTriggered',abilityId:'thorn-coat',sourceId:nextDefender.battleMonId},{kind:'damage',targetId:nextAttacker.battleMonId,amount,source:'thorn-coat'});}
 return {attacker:nextAttacker,defender:nextDefender,rngState:state,events};
}
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
function V2_assertEffectCatalog(){const abilities=Object.keys(V2_ABILITY_HOOKS).sort(),items=Object.keys(V2_ITEM_HOOKS).sort();if(new Set(V2_ABILITY_IDS).size!==24||new Set(V2_ITEM_IDS).size!==12||abilities.join('|')!==[...V2_ABILITY_IDS].sort().join('|')||items.join('|')!==[...V2_ITEM_IDS].sort().join('|'))throw new Error('invalid effect catalog');return true;}
