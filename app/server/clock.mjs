export function normalizeServerNow(value){
 const now=Math.trunc(Number(value));if(!Number.isFinite(now)||now<0)throw new Error('Invalid server clock value');return now;
}

export function createServerClock(readNow=()=>Date.now()){
 let observed=0;
 return {now(){observed=Math.max(observed,normalizeServerNow(readNow()));return observed;}};
}

export function projectedAdventureNow(state,serverNow){
 const raw=normalizeServerNow(serverNow),last=Math.max(0,Math.trunc(state?.clockV2?.lastSeenServerTime||0));return Math.max(last,raw);
}

export function advanceAdventureClock(state,serverNow){
 const effectiveNow=projectedAdventureNow(state,serverNow);state.clockV2={...(state.clockV2||{}),lastSeenServerTime:effectiveNow};return effectiveNow;
}
