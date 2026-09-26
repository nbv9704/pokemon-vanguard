export class AdventureConnection{
 constructor({url,playerId,WebSocketImpl,onState,onError,onStatus,reconnect=true,pingMs=30000,pongTimeoutMs=10000}){
  this.url=url;this.playerId=playerId;this.WebSocketImpl=WebSocketImpl;this.onState=onState;this.onError=onError;this.onStatus=onStatus;
  this.reconnect=reconnect;this.pingMs=pingMs;this.pongTimeoutMs=Math.max(50,Number(pongTimeoutMs)||10000);this.socket=null;this.retry=0;this.stopped=true;this.reconnectTimer=null;this.pingTimer=null;this.pongTimer=null;this.awaitingPong=false;
 }
 get connected(){return this.socket?.readyState===(this.WebSocketImpl.OPEN??1);}
 start(){if(!this.stopped)return;this.stopped=false;this.open();this.pingTimer=setInterval(()=>this.heartbeat(),this.pingMs);}
 clearPongWatch(){this.awaitingPong=false;clearTimeout(this.pongTimer);this.pongTimer=null;}
 markAlive(){this.clearPongWatch();}
 heartbeat(){
  const socket=this.socket;if(!socket||socket.readyState!==(this.WebSocketImpl.OPEN??1)||this.awaitingPong)return;
  this.awaitingPong=true;socket.send('__ping');clearTimeout(this.pongTimer);this.pongTimer=setTimeout(()=>this.handleHeartbeatTimeout(socket),this.pongTimeoutMs);
 }
 scheduleReconnect(){
  if(this.stopped||!this.reconnect||this.reconnectTimer)return;
  const delay=Math.min(15000,700*2**this.retry++);this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.open();},delay);
 }
 handleHeartbeatTimeout(socket){
  if(socket!==this.socket||this.stopped||!this.awaitingPong)return;
  this.clearPongWatch();this.socket=null;this.onStatus?.(false);try{socket.close(4000,'heartbeat timeout');}catch{}this.scheduleReconnect();
 }
 open(){
  if(this.stopped)return;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.clearPongWatch();
  const socket=this.socket=new this.WebSocketImpl(this.url);
  socket.onopen=()=>{if(socket!==this.socket||this.stopped)return;this.retry=0;this.markAlive();this.onStatus?.(true);socket.send(JSON.stringify({type:'join',playerId:this.playerId}));};
  socket.onmessage=event=>{
   if(socket!==this.socket)return;this.markAlive();if(event.data==='__pong')return;
   let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message?.type==='error'){this.onError?.(message.error);return;}
   if(message?.type==='state'&&message.view)this.onState?.(message.view,message);
  };
  socket.onerror=()=>{};
  socket.onclose=()=>{
   if(socket!==this.socket)return;this.clearPongWatch();this.socket=null;this.onStatus?.(false);this.scheduleReconnect();
  };
 }
 sendAction(action){if(!this.connected)return false;this.socket.send(JSON.stringify({type:'action',action}));return true;}
 stop(){this.stopped=true;clearTimeout(this.reconnectTimer);clearInterval(this.pingTimer);this.clearPongWatch();const socket=this.socket;this.socket=null;socket?.close();}
}

export function websocketUrl(locationLike,room){return (locationLike.protocol==='https:'?'wss:':'ws:')+'//'+locationLike.host+'/ws/'+encodeURIComponent(room);}
