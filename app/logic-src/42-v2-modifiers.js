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
function V2_afterDamage({attacker,defender,damage,move,rngState,moveTriedPoison=false,skipHealing=false,skipReactions=false}){
 let nextAttacker=V2_clone(attacker),nextDefender=V2_clone(defender),state=rngState,events=[];
 if(!skipHealing&&damage>0&&nextDefender.hp>0&&nextDefender.buildSnapshot.itemId==='healing-berry'&&!nextDefender.itemState.used&&nextDefender.hp*4<=nextDefender.stats.hp){const amount=Math.min(nextDefender.stats.hp-nextDefender.hp,Math.floor(nextDefender.stats.hp/4));nextDefender.hp+=amount;nextDefender.itemState.used=true;events.push({kind:'itemTriggered',itemId:'healing-berry',sourceId:nextDefender.battleMonId},{kind:'heal',targetId:nextDefender.battleMonId,amount,hpAfter:nextDefender.hp});}
 if(!skipReactions&&damage>0&&nextDefender.hp>0&&nextAttacker.buildSnapshot.abilityId==='venom-touch'&&!moveTriedPoison){const roll=V2_nextRandom(state);state=roll.state;if(roll.value<.3){const applied=V2_applyStatus(nextDefender,'poison');nextDefender=applied.mon;events.push(...applied.events);}}
 if(!skipReactions&&damage>0&&move.contact&&nextDefender.hp>0&&nextDefender.buildSnapshot.abilityId==='thorn-coat'){const amount=Math.min(nextAttacker.hp,Math.max(1,Math.floor(nextAttacker.stats.hp/16)));const hpBefore=nextAttacker.hp;nextAttacker.hp-=amount;events.push({kind:'abilityTriggered',abilityId:'thorn-coat',sourceId:nextDefender.battleMonId},{kind:'damage',targetId:nextAttacker.battleMonId,amount,hpBefore,hpAfter:nextAttacker.hp,source:'thorn-coat'});}
 return {attacker:nextAttacker,defender:nextDefender,rngState:state,events};
}
