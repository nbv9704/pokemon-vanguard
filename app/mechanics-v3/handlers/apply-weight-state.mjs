import {clone,unitById} from '../../rules-v3/battle-state.mjs';

export const applyWeightStateHandler={
 id:'apply-weight-state',hooks:['onMove'],
 run({battle,payload,params={}}){
  const next=clone(battle),actor=unitById(next,payload.action.actorId);if(!actor||actor.hp<=0)return {battle:next,payload,events:[]};
  if(params.requireStatChange===true&&!(payload.statStageChangedTargetIds||[]).includes(actor.actorId))return {battle:next,payload,events:[]};
  const amount=Number.isInteger(params.reductionHg)?params.reductionHg:1000;if(amount<1)throw new Error('apply-weight-state requires positive reductionHg');
  actor.volatiles??={};const state=actor.volatiles['weight-reduction']||{id:'weight-reduction',sourceId:payload.move.id,reductionHg:0};state.reductionHg+=amount;actor.volatiles['weight-reduction']=state;
  return {battle:next,payload:{...payload,weightReductionHg:state.reductionHg},events:[{kind:'weightReduced',actorId:actor.actorId,moveId:payload.move.id,amountHg:amount,totalReductionHg:state.reductionHg}]};
 }
};
