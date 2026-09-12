export const STAT_KEYS=['hp','atk','def','spa','spd','spe'];
export const STAT_POINT_BUDGET=66;
export const STAT_POINT_CAP=32;

export const NATURES={
 hardy:{up:null,down:null},lonely:{up:'atk',down:'def'},brave:{up:'atk',down:'spe'},adamant:{up:'atk',down:'spa'},naughty:{up:'atk',down:'spd'},
 bold:{up:'def',down:'atk'},docile:{up:null,down:null},relaxed:{up:'def',down:'spe'},impish:{up:'def',down:'spa'},lax:{up:'def',down:'spd'},
 timid:{up:'spe',down:'atk'},hasty:{up:'spe',down:'def'},serious:{up:null,down:null},jolly:{up:'spe',down:'spa'},naive:{up:'spe',down:'spd'},
 modest:{up:'spa',down:'atk'},mild:{up:'spa',down:'def'},quiet:{up:'spa',down:'spe'},bashful:{up:null,down:null},rash:{up:'spa',down:'spd'},
 calm:{up:'spd',down:'atk'},gentle:{up:'spd',down:'def'},sassy:{up:'spd',down:'spe'},careful:{up:'spd',down:'spa'},quirky:{up:null,down:null}
};

export function validateStatPoints(points){
 const problems=[];let total=0;
 for(const key of STAT_KEYS){const value=points?.[key];if(!Number.isInteger(value)||value<0||value>STAT_POINT_CAP)problems.push(`${key} must be an integer from 0 to ${STAT_POINT_CAP}`);else total+=value;}
 if(total>STAT_POINT_BUDGET)problems.push(`stat point total ${total} exceeds ${STAT_POINT_BUDGET}`);
 return problems;
}

export function natureMultiplier(natureId,stat){
 const nature=NATURES[natureId];if(!nature)throw new Error(`unknown nature: ${natureId}`);
 if(stat==='hp')return 1;
 return nature.up===stat?1.1:nature.down===stat?.9:1;
}

export function stageMultiplier(stage=0){
 const bounded=Math.max(-6,Math.min(6,stage));
 return bounded>=0?(2+bounded)/2:2/(2-bounded);
}

export function stagedStat(value,stage=0){
 if(!Number.isFinite(value)||value<0)throw new Error('stat must be a non-negative number');
 return Math.max(1,Math.floor(value*stageMultiplier(stage)));
}

export function calculateLevel50Stats(baseStats,points,natureId='serious'){
 const problems=validateStatPoints(points);if(problems.length)throw new Error(problems.join('; '));
 for(const key of STAT_KEYS)if(!Number.isInteger(baseStats?.[key])||baseStats[key]<1)throw new Error(`invalid base stat: ${key}`);
 const stats={hp:baseStats.hp+75+points.hp};
 for(const key of STAT_KEYS.slice(1))stats[key]=Math.floor((baseStats[key]+20+points[key])*natureMultiplier(natureId,key));
 return stats;
}
