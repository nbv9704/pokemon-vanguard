export function nextRandom(rngState){
 if(!Number.isInteger(rngState)||rngState<0||rngState>0xffffffff)throw new Error('rngState must be an unsigned 32-bit integer');
 const next=(Math.imul(rngState>>>0,1664525)+1013904223)>>>0;
 return {rngState:next,value:next/4294967296};
}

export function randomInteger(rngState,min,max){
 if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)throw new Error('invalid random integer range');
 const roll=nextRandom(rngState);
 return {rngState:roll.rngState,value:min+Math.floor(roll.value*(max-min+1))};
}
