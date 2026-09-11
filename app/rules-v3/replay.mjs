import {clone} from './battle-state.mjs';
import {applyReplacements,completeEntry,resolveEndTurn} from './lifecycle.mjs';
import {resolveActionQueue} from './turn-engine.mjs';

export function replayBattle(initialBattle,commands,{handlers}={}){
 let battle=clone(initialBattle);const events=[];
 for(const command of commands){
  let result;
  if(command.kind==='turn')result=resolveActionQueue(battle,command.actions,handlers,command.options);
  else if(command.kind==='endTurn')result=resolveEndTurn(battle,command.groups);
  else if(command.kind==='replacements')result=applyReplacements(battle,command.choices);
  else if(command.kind==='entry')result=completeEntry(battle,command.events);
  else throw new Error(`unknown replay command: ${command.kind}`);
  if(!result.ok)throw new Error(`replay command failed: ${result.code}`);
  battle=result.battle;events.push(...result.events);
 }
 return {battle,events};
}

export function verifyDeterministicReplay(initialBattle,commands,options){
 const first=replayBattle(initialBattle,commands,options),second=replayBattle(initialBattle,commands,options);
 if(JSON.stringify(first)!==JSON.stringify(second))throw new Error('replay is not deterministic');
 return first;
}
