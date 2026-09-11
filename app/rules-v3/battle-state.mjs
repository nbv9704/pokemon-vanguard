export const clone=value=>JSON.parse(JSON.stringify(value));
export const otherSide=side=>side==='A'?'B':'A';

export function unitById(battle,actorId){
 for(const side of ['A','B']){const unit=battle.sides?.[side]?.roster?.find(entry=>entry.actorId===actorId);if(unit)return unit;}
 return null;
}

export function activeUnits(battle,side,{includeFainted=false}={}){
 return (battle.sides?.[side]?.active||[]).map((actorId,slot)=>({side,slot,actorId,unit:unitById(battle,actorId)})).filter(entry=>entry.actorId&&entry.unit&&(includeFainted||entry.unit.hp>0));
}

export function reserveUnits(battle,side){
 const active=new Set(battle.sides?.[side]?.active||[]);
 return (battle.sides?.[side]?.roster||[]).filter(unit=>unit.hp>0&&!active.has(unit.actorId));
}

export function actorAvailable(battle,side,actorId){
 return activeUnits(battle,side).some(entry=>entry.actorId===actorId);
}

export function livingCount(battle,side){return (battle.sides?.[side]?.roster||[]).filter(unit=>unit.hp>0).length;}

export function replaceUnit(battle,updated){
 const next=clone(battle);
 for(const side of ['A','B']){const index=next.sides[side].roster.findIndex(unit=>unit.actorId===updated.actorId);if(index>=0){next.sides[side].roster[index]=clone(updated);return next;}}
 throw new Error(`unknown actor: ${updated.actorId}`);
}
