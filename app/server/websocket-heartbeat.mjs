export function markWebSocketAlive(ws){
 if(!ws)return false;
 ws.isAlive=true;
 ws.on?.('pong',()=>{ws.isAlive=true;});
 return true;
}

export function heartbeatWebSockets(wss){
 for(const ws of wss?.clients||[]){
  if(ws.isAlive===false){ws.terminate?.();continue;}
  ws.isAlive=false;
  try{ws.ping?.();}catch{ws.terminate?.();}
 }
}

export function startWebSocketHeartbeat(wss,{intervalMs=10_000,setIntervalImpl=setInterval}={}){
 const timer=setIntervalImpl(()=>heartbeatWebSockets(wss),Math.max(1_000,Number(intervalMs)||10_000));
 timer?.unref?.();
 return timer;
}
