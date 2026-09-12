import {applyRedirection} from '../redirection-state.mjs';

export const applyRedirectionHandler={
 id:'apply-redirection',hooks:['onMove'],
 run({battle,payload,params}){
  const {action,move}=payload,result=applyRedirection(battle,{side:action.side,actorId:action.actorId,moveId:move.id,kind:params.kind});
  return {battle:result.battle,payload:{...payload,redirectionSucceeded:result.succeeded},events:result.events};
 }
};
