import {applySubstitute} from '../substitute.mjs';
export const applySubstituteHandler={id:'apply-substitute',hooks:['onMove'],run({battle,payload}){const result=applySubstitute(battle,{actorId:payload.action.actorId,moveId:payload.move.id});return {battle:result.battle,payload:{...payload,substituteApplied:result.applied},events:result.events};}};
