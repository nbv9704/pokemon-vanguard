import {V2_activeEntries,V2_calculateDamage,V2_effectiveness,V2_monById,V2_reserves} from '../src/v2-engine.mjs';

const nextRandom=state=>{const next=(Math.imul(state>>>0,1103515245)+12345)>>>0;return {state:next,value:next/4294967296};};
const other=side=>side==='A'?'B':'A';

export function chooseAiLineup(template,mode,playerPublicRoster,catalog){
 const count=mode==='double'?4:3,targets=playerPublicRoster.flatMap(entry=>entry.types),ranked=template.speciesIds.map((id,index)=>{const species=catalog.speciesById[id],coverage=species.defaultBuild.moveIds.map(moveId=>catalog.movesById[moveId]).filter(move=>move.power>0).reduce((sum,move)=>sum+targets.reduce((v,type)=>v+(V2_effectiveness(move.type,[type])>1?1:0),0),0);return {id,index,coverage};}).sort((a,b)=>b.coverage-a.coverage||a.index-b.index);return ranked.slice(0,count).map(entry=>entry.id);
}

function moveCandidates(battle,side,actor,moves){
 const foe=other(side),activeFoes=V2_activeEntries(battle,foe),activeAllies=V2_activeEntries(battle,side),result=[];
 for(const moveId of actor.buildSnapshot.moveIds){const move=moves[moveId];if(!move||(actor.pp[moveId]||0)<=0)continue;let targets=[null];if(move.targetMode==='foe')targets=activeFoes.map(entry=>({side:foe,slot:entry.slot}));if(move.targetMode==='ally')targets=activeAllies.filter(entry=>entry.mon.battleMonId!==actor.battleMonId).map(entry=>({side,slot:entry.slot}));if(!targets.length)continue;for(const target of targets)result.push({command:{kind:'move',actorId:actor.battleMonId,moveId,...(target?{target}:{})},move});}
 if(!result.length)result.push({command:{kind:'move',actorId:actor.battleMonId,moveId:'struggle',target:{side:foe,slot:activeFoes[0]?.slot||0}},move:{id:'struggle',category:'physical',power:50,targetMode:'foe'}});
 for(const reserve of V2_reserves(battle,side))result.push({command:{kind:'switch',actorId:actor.battleMonId,toId:reserve.battleMonId},move:null});return result;
}

function scoreCandidate(candidate,battle,side,actor,moves){
 if(candidate.command.kind==='switch')return 4;const move=candidate.move;if(move.power>0){const targets=move.targetMode==='allFoes'?V2_activeEntries(battle,other(side)).map(entry=>entry.mon):[V2_monById(battle,battle.sides[other(side)].active[candidate.command.target?.slot??0])].filter(Boolean);return targets.reduce((score,target)=>{const estimate=V2_calculateDamage({move,attacker:actor,defender:target,field:battle.field,spread:targets.length>1?.75:1}).damage,percent=estimate/target.stats.hp*100;return score+percent+(estimate>=target.hp?40:0)-Math.max(0,estimate-target.hp)/target.stats.hp*20;},0);}
 const text=JSON.stringify(move.effects||[]);if(/"heal"/.test(text))return (1-actor.hp/actor.stats.hp)*65;if(/setWeather|setTerrain|setSideCondition/.test(text))return 22;if(/applyStatus|changeStage|guard|redirect/.test(text))return 14;return 2;
}

function legalCombination(entries){const switches=entries.filter(entry=>entry.command.kind==='switch').map(entry=>entry.command.toId);if(new Set(switches).size!==switches.length)return false;const fields=entries.map(entry=>JSON.stringify(entry.move?.effects||[])).filter(text=>/setWeather|setTerrain/.test(text));return fields.length<2||new Set(fields).size===1;}

export function chooseAiCommands(battle,{side='B',difficulty='normal',moves,aiRngState=1}={}){
 const actors=V2_activeEntries(battle,side).map(entry=>entry.mon),groups=actors.map(actor=>moveCandidates(battle,side,actor,moves).map(candidate=>({...candidate,score:scoreCandidate(candidate,battle,side,actor,moves)})).sort((a,b)=>b.score-a.score).slice(0,6));let rng=nextRandom(aiRngState),chosen=[];
 if(difficulty==='easy'){for(const group of groups){const damaging=group.filter(entry=>entry.move?.power>0),pool=damaging.length?damaging:group,r=nextRandom(rng.state);rng=r;chosen.push(pool[Math.floor(r.value*pool.length)]);}}
 else if(difficulty==='hard'&&groups.length===2){let options=[];for(const a of groups[0])for(const b of groups[1])if(legalCombination([a,b]))options.push({entries:[a,b],score:a.score+b.score+(/setSideCondition|heal|redirect/.test(JSON.stringify(a.move?.effects||[])+JSON.stringify(b.move?.effects||[]))?15:0)});options.sort((a,b)=>b.score-a.score);const near=options.filter(option=>option.score>=options[0].score-3),r=nextRandom(rng.state);rng=r;chosen=near[Math.floor(r.value*near.length)].entries;}
 else{for(const group of groups){const available=group.filter(candidate=>candidate.command.kind!=='switch'||!chosen.some(entry=>entry.command.toId===candidate.command.toId)),best=available[0].score,near=available.filter(entry=>entry.score>=best-2),r=nextRandom(rng.state);rng=r;chosen.push(near[Math.floor(r.value*near.length)]);}}
 return {commands:chosen.map(entry=>entry.command),aiRngState:rng.state};
}
