import {activeUnits,clone,unitById} from '../rules-v3/battle-state.mjs';
import {applyHpGroup,resolveEndTurn} from '../rules-v3/lifecycle.mjs';
import {prepareMajorStatusEndTurn} from './major-status-residual.mjs';
import {weatherHealingGroup} from './weather.mjs';

const maxHp=unit=>unit.maxHp??unit.stats?.hp;

function sourceAtSlot(battle,state){
 const actorId=battle.sides?.[state.sourceSide]?.active?.[state.sourceSlot],unit=actorId&&unitById(battle,actorId);
 return unit?.hp>0?unit:null;
}

export function applyLinkedResiduals(battle){
 let next=clone(battle);const links=[];
 for(const side of ['A','B'])for(const {unit} of activeUnits(next,side)){
  const state=unit.volatiles?.['leech-seed'],source=state&&sourceAtSlot(next,state);
  if(source)links.push({targetId:unit.actorId,sourceId:source.actorId,amount:Math.max(1,Math.floor(maxHp(unit)/8))});
 }
 const damage=applyHpGroup(next,links.map(link=>({actorId:link.targetId,delta:-link.amount})),'leech-seed-damage');next=damage.battle;
 const actualByTarget=new Map(damage.events.filter(event=>event.kind==='damage').map(event=>[event.targetId,event.amount])),healing=new Map();
 for(const link of links){const amount=actualByTarget.get(link.targetId)||0;if(amount)healing.set(link.sourceId,(healing.get(link.sourceId)||0)+amount);}
 const heal=applyHpGroup(next,[...healing].map(([actorId,amount])=>({actorId,delta:amount})),'leech-seed-heal');next=heal.battle;
 return {battle:next,events:[...damage.events,...heal.events]};
}

export function resolveMechanicsEndTurn(battle,groups=[]){
 const linked=applyLinkedResiduals(battle),major=prepareMajorStatusEndTurn(linked.battle);
 return resolveEndTurn(major.battle,[...groups,weatherHealingGroup(major.battle),major.group],{initialEvents:[{kind:'endTurnStarted',turn:battle.turn},...linked.events]});
}
