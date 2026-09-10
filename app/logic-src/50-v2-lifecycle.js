function V2_replaceMon(battle,updated){for(const side of ['A','B']){const index=battle.sides[side].roster.findIndex(mon=>mon.battleMonId===updated.battleMonId);if(index>=0){battle.sides[side].roster[index]=updated;return;}}}
function V2_applyHpGroup(battle,changes,source){
 const next=V2_clone(battle),events=[];
 for(const change of changes){const mon=V2_monById(next,change.monId);if(!mon||mon.hp<=0)continue;const before=mon.hp,after=Math.max(0,Math.min(mon.stats.hp,before+change.delta));mon.hp=after;const amount=Math.abs(after-before);if(!amount)continue;events.push({kind:change.delta<0?'damage':'heal',targetId:mon.battleMonId,hpBefore:before,hpAfter:after,amount,source});if(after===0)events.push({kind:'fainted',targetId:mon.battleMonId});}
 return {battle:next,events};
}
function V2_livingCount(battle,side){return battle.sides[side].roster.filter(mon=>mon.hp>0).length;}
function V2_finishBattle(battle,winner,reason){
 if(battle.result)return {battle,events:[]};const next=V2_clone(battle),receiptId=`${next.id}:result`;next.phase='FINISHED';next.phaseRevision=(next.phaseRevision||0)+1;next.result={winner,reason,turn:next.turn,receiptId};next.rewardReceipts=next.rewardReceipts||[];if(!next.rewardReceipts.some(entry=>entry.receiptId===receiptId))next.rewardReceipts.push({receiptId,battleId:next.id,winner,reason});return {battle:next,events:[{kind:'battleEnded',winner,reason,receiptId}]};
}
function V2_checkResult(battle,{turnCap=100}={}){const a=V2_livingCount(battle,'A'),b=V2_livingCount(battle,'B');if(!a&&!b)return V2_finishBattle(battle,null,'draw-ko');if(!a)return V2_finishBattle(battle,'B','all-fainted');if(!b)return V2_finishBattle(battle,'A','all-fainted');if(battle.turn>=turnCap)return V2_finishBattle(battle,null,'turn-cap');return {battle,events:[]};}
function V2_expireConditions(battle){
 const next=V2_clone(battle),events=[];
 for(const kind of ['weather','terrain']){const effect=next.field[kind];if(effect){effect.remaining--;if(effect.remaining<=0){events.push({kind:'effectExpired',field:kind,value:effect.id});next.field[kind]=null;}}}
 for(const side of ['A','B'])for(const id of ['tailwind','barrier'])if(next.field.sides[side][id]>0){next.field.sides[side][id]--;if(next.field.sides[side][id]===0)events.push({kind:'effectExpired',field:'side',side,value:id});}
 for(const side of ['A','B'])for(const {mon} of V2_activeEntries(next,side)){mon.volatiles.guarded=false;mon.volatiles.redirect=false;}
 return {battle:next,events};
}
function V2_endTurn(battle){
 if(battle.phase!=='END_TURN')return {ok:false,code:'WRONG_PHASE'};let current=V2_clone(battle),events=[];
 const active=()=>['A','B'].flatMap(side=>V2_activeEntries(current,side).map(entry=>({...entry,side})));
 let changes=active().flatMap(({mon})=>{const status=mon.status?.id||mon.status;if(status==='burn')return [{monId:mon.battleMonId,delta:-Math.max(1,Math.floor(mon.stats.hp/16))}];if(status==='poison')return [{monId:mon.battleMonId,delta:-Math.max(1,Math.floor(mon.stats.hp/8))}];return [];});let group=V2_applyHpGroup(current,changes,'major-status');current=group.battle;events.push(...group.events);
 if(current.field.weather?.id==='sand'){changes=active().filter(({mon})=>!mon.types.includes('Stone')&&!mon.types.includes('Steel')).map(({mon})=>({monId:mon.battleMonId,delta:-Math.max(1,Math.floor(mon.stats.hp/16))}));group=V2_applyHpGroup(current,changes,'sand');current=group.battle;events.push(...group.events);}
 changes=active().filter(({mon})=>mon.buildSnapshot.itemId==='vital-seed').map(({mon})=>({monId:mon.battleMonId,delta:Math.max(1,Math.floor(mon.stats.hp*.08))}));group=V2_applyHpGroup(current,changes,'vital-seed');current=group.battle;events.push(...group.events);
 changes=[];for(const {mon,side} of active())if(mon.buildSnapshot.abilityId==='radiance')changes.push({monId:mon.battleMonId,delta:Math.max(1,Math.floor(mon.stats.hp*.05))});else if(mon.buildSnapshot.abilityId==='healer'){const allies=V2_activeEntries(current,side).filter(entry=>entry.mon.battleMonId!==mon.battleMonId&&entry.mon.hp>0&&entry.mon.hp<entry.mon.stats.hp).sort((a,b)=>a.mon.hp/a.mon.stats.hp-b.mon.hp/b.mon.stats.hp||a.slot-b.slot);if(allies[0])changes.push({monId:allies[0].mon.battleMonId,delta:Math.max(1,Math.floor(allies[0].mon.stats.hp*.05))});}group=V2_applyHpGroup(current,changes,'ability');current=group.battle;events.push(...group.events);
 if(current.field.terrain?.id==='meadow'){changes=active().filter(({mon})=>!mon.types.includes('Gale')).map(({mon})=>({monId:mon.battleMonId,delta:Math.max(1,Math.floor(mon.stats.hp/16))}));group=V2_applyHpGroup(current,changes,'meadow');current=group.battle;events.push(...group.events);}
 const expired=V2_expireConditions(current);current=expired.battle;events.push(...expired.events,{kind:'turnEnded',turn:battle.turn});const result=V2_checkResult(current);current=result.battle;events.push(...result.events);
 if(current.phase!=='FINISHED'){const needs=['A','B'].some(side=>current.sides[side].active.some(id=>!id||V2_monById(current,id)?.hp<=0)&&V2_reserves(current,side).length);current.phase=needs?'REPLACE':'COMMAND';current.phaseRevision=(current.phaseRevision||0)+1;if(!needs)current.turn++;}
 return {ok:true,battle:current,events};
}
function V2_validateReplacements(battle,side,replacements){
 if(battle.phase!=='REPLACE')return {ok:false,code:'WRONG_PHASE'};const empty=battle.sides[side].active.map((id,slot)=>({id,slot})).filter(entry=>!entry.id||V2_monById(battle,entry.id)?.hp<=0),reserves=V2_reserves(battle,side),count=Math.min(empty.length,reserves.length);
 if(!Array.isArray(replacements)||replacements.length!==count)return {ok:false,code:'INVALID_REPLACEMENT_COUNT'};const slots=new Set(),ids=new Set();for(const choice of replacements)if(!empty.some(entry=>entry.slot===choice.slot)||!reserves.some(mon=>mon.battleMonId===choice.monId)||slots.has(choice.slot)||ids.has(choice.monId))return {ok:false,code:'INVALID_REPLACEMENT'};else{slots.add(choice.slot);ids.add(choice.monId);}return {ok:true,replacements:V2_clone(replacements)};
}
function V2_applyReplacements(battle,choicesBySide){
 const next=V2_clone(battle),events=[];for(const side of ['A','B']){const valid=V2_validateReplacements(next,side,choicesBySide[side]||[]);if(!valid.ok)return valid;for(const choice of valid.replacements){next.sides[side].active[choice.slot]=choice.monId;events.push({kind:'switchIn',actorId:choice.monId,side,slot:choice.slot,replacement:true});}}
 next.phase='ENTRY';next.phaseRevision=(next.phaseRevision||0)+1;next.turn++;return {ok:true,battle:next,events};
}
