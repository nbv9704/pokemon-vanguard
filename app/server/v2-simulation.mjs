import {V2_applyReplacements,V2_assertBattleInvariants,V2_resolveTurn,V2_submitCommands} from '../src/v2-engine.mjs';
import {chooseAiCommands,chooseAiLineup} from './v2-ai.mjs';
import {aiReplacements,battleMon,enterBattle,projectBattleForAi} from './v2-battle-factory.mjs';

const publicRoster=(team,catalog)=>team.speciesIds.map(id=>({speciesId:id,types:catalog.speciesById[id].types}));
const mix=(seed,value)=>(Math.imul((seed^value)>>>0,2654435761)>>>0)||1;

export function createSimulationBattle({teamA,teamB,mode,seed,catalog}){
 const selectedA=chooseAiLineup(teamA,mode,publicRoster(teamB,catalog),catalog),selectedB=chooseAiLineup(teamB,mode,publicRoster(teamA,catalog),catalog),activeCount=mode==='double'?2:1;
 const roster=(side,ids)=>ids.map((id,index)=>battleMon(side,index,structuredClone(catalog.speciesById[id].defaultBuild),catalog.speciesById[id],catalog));
 const battle={id:`sim-${seed}`,phase:'ENTRY',phaseRevision:1,turn:1,activeCount,rngState:mix(seed,0xb477),eventSequence:0,events:[],result:null,rewardReceipts:[],pending:{},queue:[],field:{weather:null,terrain:null,sides:{A:{tailwind:0,barrier:0},B:{tailwind:0,barrier:0}}},sides:{A:{roster:roster('A',selectedA),active:[]},B:{roster:roster('B',selectedB),active:[]}}};
 for(const side of ['A','B'])battle.sides[side].active=battle.sides[side].roster.slice(0,activeCount).map(mon=>mon.battleMonId);
 return {battle:enterBattle(battle,[]).battle,selectedA,selectedB};
}

function countMoves(target,events){for(const event of events)if(event.kind==='moveStarted'&&event.moveId)target[event.moveId]=(target[event.moveId]||0)+1;}

export function simulateV2Match({teamA,teamB,mode,seed,catalog,difficulty='hard'}){
 const created=createSimulationBattle({teamA,teamB,mode,seed,catalog});let battle=created.battle,aiA=mix(seed,0xa11),aiB=mix(seed,0xb22),guard=0;const moveUsage={};
 while(battle.phase!=='FINISHED'&&guard++<130){
  if(battle.phase==='COMMAND'){
   const a=chooseAiCommands(projectBattleForAi(battle,catalog,'A'),{side:'A',difficulty,moves:catalog.movesById,aiRngState:aiA});aiA=a.aiRngState;
   const first=V2_submitCommands(battle,'A',a.commands,catalog.movesById);if(!first.ok)throw new Error(`Simulation A command failed: ${first.code}`);
   const b=chooseAiCommands(projectBattleForAi(first.battle,catalog,'B'),{side:'B',difficulty,moves:catalog.movesById,aiRngState:aiB});aiB=b.aiRngState;
   const second=V2_submitCommands(first.battle,'B',b.commands,catalog.movesById);if(!second.ok)throw new Error(`Simulation B command failed: ${second.code}`);
   const resolved=V2_resolveTurn(second.battle,catalog.movesById);if(!resolved.ok)throw new Error(`Simulation resolve failed: ${resolved.code}`);battle=resolved.battle;countMoves(moveUsage,resolved.events);
  }else if(battle.phase==='REPLACE'){
   const replaced=V2_applyReplacements(battle,{A:aiReplacements(battle,'A'),B:aiReplacements(battle,'B')});if(!replaced.ok)throw new Error(`Simulation replacement failed: ${replaced.code}`);battle=enterBattle(replaced.battle,replaced.events).battle;
  }else throw new Error(`Simulation stopped in unsupported phase ${battle.phase}`);
  V2_assertBattleInvariants(battle);
 }
 const timedOut=battle.phase!=='FINISHED'||battle.result?.reason==='turn-cap',winner=battle.result?.winner==='A'?teamA.id:battle.result?.winner==='B'?teamB.id:'draw';
 return {seed,mode,matchup:`${teamA.id}-vs-${teamB.id}`,firstSide:teamA.id,aiDifficulty:difficulty,turns:battle.turn,winner,moveUsage:Object.entries(moveUsage).sort().map(([id,count])=>`${id}:${count}`).join(';'),speciesUsage:`A:${created.selectedA.join('|')};B:${created.selectedB.join('|')}`,timeout:timedOut};
}

function simulationPairs(teams){const pairs=[];for(let a=0;a<teams.length;a++)for(let b=a+1;b<teams.length;b++)for(const mode of ['single','double']){pairs.push({teamA:teams[a],teamB:teams[b],mode});pairs.push({teamA:teams[b],teamB:teams[a],mode});}return pairs;}

export function simulationSchedule(teams,matches,seed){
 const pairs=simulationPairs(teams);
 return Array.from({length:matches},(_,index)=>({...pairs[index%pairs.length],seed:(seed+index)>>>0}));
}

export function simulationScheduleSlice(teams,start,count,seed){const pairs=simulationPairs(teams);return Array.from({length:count},(_,offset)=>{const index=start+offset;return {...pairs[index%pairs.length],seed:(seed+index)>>>0};});}
