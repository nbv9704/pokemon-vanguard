// Best-effort in-process flow control. This does not replace proxy rate limits
// or distributed abuse controls; it prevents one slow client from growing an
// unbounded socket write buffer or an unbounded room action backlog.
export const WS_LIMITS=Object.freeze({pendingMessagesPerSocket:32,maxBufferedBytes:8*1024*1024});
export function createInboundLimiter({maxPending=WS_LIMITS.pendingMessagesPerSocket}={}){
 const counts=new WeakMap();
 return {
  acquire(socket){const count=counts.get(socket)||0;if(count>=maxPending)return false;counts.set(socket,count+1);return true;},
  release(socket){const count=counts.get(socket)||0;if(count<=1)counts.delete(socket);else counts.set(socket,count-1);},
  pending(socket){return counts.get(socket)||0;}
 };
}
export function sendBounded(ws,message,{maxBufferedBytes=WS_LIMITS.maxBufferedBytes,openState=1,onDrop}={}){
 return sendSerializedBounded(ws,JSON.stringify(message),{maxBufferedBytes,openState,onDrop});
}
export function sendSerializedBounded(ws,serialized,{maxBufferedBytes=WS_LIMITS.maxBufferedBytes,openState=1,onDrop=()=>{}}={}){
 if(ws.readyState!==openState){onDrop('closed');return false;}
 if(ws.bufferedAmount>maxBufferedBytes){onDrop('backpressure');try{ws.terminate();}catch{}return false;}
 try{ws.send(serialized);return true;}catch{onDrop('error');try{ws.terminate();}catch{}return false;}
}
