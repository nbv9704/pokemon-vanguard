const V2_STRONG={Flame:['Bloom','Frost','Steel'],Tide:['Flame','Stone'],Bloom:['Tide','Stone'],Volt:['Tide','Gale'],Frost:['Bloom','Gale'],Stone:['Flame','Volt'],Gale:['Bloom','Venom'],Shadow:['Astral','Light'],Light:['Shadow','Venom'],Venom:['Bloom','Light'],Steel:['Frost','Light'],Astral:['Venom','Steel']};
const V2_RESIST={Flame:['Flame','Tide','Stone'],Tide:['Tide','Bloom'],Bloom:['Flame','Bloom','Gale','Steel'],Volt:['Volt','Bloom'],Frost:['Flame','Frost','Steel'],Stone:['Bloom','Steel'],Gale:['Volt','Steel'],Shadow:['Shadow','Steel'],Light:['Light','Steel'],Venom:['Venom','Stone'],Steel:['Flame','Tide','Steel'],Astral:['Astral']};
const V2_IMMUNE={Volt:['Stone'],Venom:['Steel'],Astral:['Shadow']};
function V2_effectiveness(type,targetTypes){return targetTypes.reduce((value,targetType)=>value*(V2_IMMUNE[type]?.includes(targetType)?0:V2_STRONG[type]?.includes(targetType)?2:V2_RESIST[type]?.includes(targetType)?.5:1),1);}
function V2_stageMultiplier(stage){const value=Math.max(-6,Math.min(6,stage||0));return value>=0?(2+value)/2:2/(2-value);}
function V2_calculateDamage({move,attacker,defender,field={},outgoing=1,incoming=1,spread=1}){
 const physical=move.category==='physical',attackKey=physical?'atk':'spa',defenseKey=physical?'def':'spd';
 const attack=Math.floor(attacker.stats[attackKey]*V2_stageMultiplier(attacker.stages?.[attackKey]));
 let defense=Math.floor(defender.stats[defenseKey]*V2_stageMultiplier(defender.stages?.[defenseKey]));defense=Math.max(1,defense);
 const base=Math.floor(22*move.power*attack/defense/50)+2,type=V2_effectiveness(move.type,defender.types),stab=attacker.types.includes(move.type)?1.5:1;
 if(type===0)return {damage:0,base,attack,defense,stab,type};
 let fieldModifier=1;
 const weather=field.weather?.id||field.weather,terrain=field.terrain?.id||field.terrain;
 if(weather==='sun')fieldModifier*=move.type==='Flame'?1.5:move.type==='Tide'?.5:1;
 if(weather==='rain')fieldModifier*=move.type==='Tide'?1.5:move.type==='Flame'?.5:1;
 if(terrain==='meadow'&&move.type==='Bloom')fieldModifier*=1.3;
 if(terrain==='storm'&&move.type==='Volt')fieldModifier*=1.3;
 const burn=physical&&attacker.status==='burn'?.5:1;
 return {damage:Math.max(1,Math.floor(base*stab*type*fieldModifier*outgoing*incoming*spread*burn)),base,attack,defense,stab,type,fieldModifier,burn};
}
function V2_spendPp(mon,moveId){if(!Number.isInteger(mon.pp?.[moveId])||mon.pp[moveId]<=0)return {ok:false,mon};const next=JSON.parse(JSON.stringify(mon));next.pp[moveId]--;return {ok:true,mon:next};}
function V2_allMovesEmpty(mon,moveIds){return moveIds.every(id=>(mon.pp?.[id]||0)<=0);}
function V2_nextRandom(state){const next=(Math.imul(state>>>0,1664525)+1013904223)>>>0;return {state:next,value:next/4294967296};}
function V2_accuracyCheck(accuracy,state){const roll=V2_nextRandom(state);return {hit:accuracy>=100||roll.value<accuracy/100,rngState:roll.state,roll:roll.value};}
const V2_STRUGGLE={id:'struggle',type:null,category:'physical',power:50,accuracy:100,maxPP:null,targetMode:'foe',recoilFraction:.25};
function V2_moveGate({mon,move,targetTypes,guarded=false,rngState}){
 const spent=V2_spendPp(mon,move.id);if(!spent.ok)return {outcome:'noPP',mon,rngState};
 if(guarded)return {outcome:'guarded',mon:spent.mon,rngState};
 if(move.type&&V2_effectiveness(move.type,targetTypes)===0)return {outcome:'immune',mon:spent.mon,rngState};
 const accuracy=V2_accuracyCheck(move.accuracy,rngState);return {outcome:accuracy.hit?'hit':'missed',mon:spent.mon,rngState:accuracy.rngState,roll:accuracy.roll};
}
function V2_struggleRecoil(actualDamage){return actualDamage>0?Math.max(1,Math.floor(actualDamage*V2_STRUGGLE.recoilFraction)):0;}
