import {activeUnits,clone} from '../rules-v3/battle-state.mjs';
import {resolveEndTurn} from '../rules-v3/lifecycle.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;

export function prepareMajorStatusEndTurn(battle){
 const next=clone(battle),changes=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const status=unit.status?.id||unit.status,limit=maxHp(unit);
  if(status==='burn')changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(limit/16))});
  if(status==='poison')changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(limit/8))});
  if(status==='bad-poison'){
   const counter=Math.min(15,(unit.status?.toxicCounter||0)+1);
   if(typeof unit.status==='object')unit.status.toxicCounter=counter;
   else unit.status={id:'bad-poison',sourceId:null,turnsActive:0,toxicCounter:counter};
   changes.push({actorId:unit.actorId,delta:-Math.max(1,Math.floor(limit/16))*counter});
  }
 }
 return {battle:next,group:{id:'major-status-residual',changes}};
}

export function majorStatusEndTurnGroup(battle){return prepareMajorStatusEndTurn(battle).group;}

export function resolveMajorStatusEndTurn(battle,groups=[]){
 const prepared=prepareMajorStatusEndTurn(battle);
 return resolveEndTurn(prepared.battle,[...groups,prepared.group]);
}
