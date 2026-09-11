import {clone} from './battle-state.mjs';

export function commitEvents(battle,events){
 const next=clone(battle),committed=[];
 next.eventSequence=next.eventSequence||0;next.events=next.events||[];
 for(const raw of events){
  const event={...clone(raw),id:`${next.id}:event:${++next.eventSequence}`};
  committed.push(event);next.events.push(event);
 }
 return {battle:next,events:committed};
}
