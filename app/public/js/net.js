// Browser connection. A socket OPEN is not proof that join completed or data saved.
const TERMINAL_CLOSE_CODES=new Set([4001,4003,4401,4403]);
export class AdventureConnection{
 constructor({url,playerId,WebSocketImpl,onState,onError,onStatus,onActionAck,onFatal,reconnect=true,pingMs=30000,pongTimeoutMs=10000,joinTimeoutMs=12000,random=Math.random}){
  this.url=url;this.playerId=playerId;this.WebSocketImpl=WebSocketImpl;this.onState=onState;this.onError=onError;this.onStatus=onStatus;this.onActionAck=onActionAck;this.onFatal=onFatal;
  this.reconnect=reconnect;this.random=random;this.pingMs=pingMs;this.pongTimeoutMs=Math.max(50,Number(pongTimeoutMs)||10000);this.joinTimeoutMs=Math.max(50,Number(joinTimeoutMs)||12000);
  this.socket=null;this.retry=0;this.stopped=true;this.joined=false;this.reconnectTimer=null;this.pingTimer=null;this.pongTimer=null;this.joinTimer=null;this.awaitingPong=false;
 }
 get connected(){return this.socket?.readyState===(this.WebSocketImpl.OPEN??1);}
 start(){if(!this.stopped)return;this.stopped=false;this.open();this.pingTimer=setInterval(()=>this.heartbeat(),this.pingMs);}
 clearPongWatch(){this.awaitingPong=false;clearTimeout(this.pongTimer);this.pongTimer=null;}
 clearJoinWatch(){clearTimeout(this.joinTimer);this.joinTimer=null;}
 markAlive(){this.clearPongWatch();}
 heartbeat(){const socket=this.socket;if(!socket||socket.readyState!==(this.WebSocketImpl.OPEN??1)||this.awaitingPong)return;this.awaitingPong=true;socket.send('__ping');this.pongTimer=setTimeout(()=>this.handleHeartbeatTimeout(socket),this.pongTimeoutMs);}
 scheduleReconnect(){
  if(this.stopped||!this.reconnect||this.reconnectTimer)return;
  const jitter=Math.max(0,Math.min(1,Number(this.random())||0)),base=Math.min(15000,700*2**this.retry++),delay=Math.round(base*(.8+.4*jitter));
  this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.open();},delay);
 }
 disconnectUnhealthy(socket,reason){
  if(socket!==this.socket||this.stopped)return;
  this.clearPongWatch();this.clearJoinWatch();this.joined=false;this.socket=null;this.onStatus?.(false);
  try{socket.close(4000,reason);}catch{}this.scheduleReconnect();
 }
 handleHeartbeatTimeout(socket){if(this.awaitingPong)this.disconnectUnhealthy(socket,'heartbeat timeout');}
 handleJoinTimeout(socket){if(!this.joined)this.disconnectUnhealthy(socket,'join timeout');}
 open(){
  if(this.stopped)return;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.clearPongWatch();this.clearJoinWatch();this.joined=false;
  const socket=this.socket=new this.WebSocketImpl(this.url);
  socket.onopen=()=>{
   if(socket!==this.socket||this.stopped)return;this.markAlive();this.onStatus?.(true);
   socket.send(JSON.stringify({type:'join',playerId:this.playerId}));
   this.joinTimer=setTimeout(()=>this.handleJoinTimeout(socket),this.joinTimeoutMs);
  };
  socket.onmessage=event=>{
   if(socket!==this.socket)return;this.markAlive();if(event.data==='__pong')return;
   let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message?.type==='error'){this.onError?.(message.error,message);return;}
   if(message?.type==='action-ack'){this.onActionAck?.(message);return;}
   if(message?.type==='state'&&message.view){if(!this.joined){this.joined=true;this.retry=0;this.clearJoinWatch();}this.onState?.(message.view,message);}
  };
  socket.onerror=()=>{};
  socket.onclose=event=>{
   if(socket!==this.socket)return;this.clearPongWatch();this.clearJoinWatch();this.joined=false;this.socket=null;this.onStatus?.(false);
   if(TERMINAL_CLOSE_CODES.has(event?.code)){this.stopped=true;clearInterval(this.pingTimer);this.onFatal?.(event.code);return;}
   this.scheduleReconnect();
  };
 }
 sendAction(action){if(!this.connected||!this.joined)return false;this.socket.send(JSON.stringify({type:'action',action}));return true;}
 stop(){this.stopped=true;clearTimeout(this.reconnectTimer);clearInterval(this.pingTimer);this.clearPongWatch();this.clearJoinWatch();this.joined=false;const socket=this.socket;this.socket=null;socket?.close();}
}
export function websocketUrl(locationLike,room){return (locationLike.protocol==='https:'?'wss:':'ws:')+'//'+locationLike.host+'/ws/'+encodeURIComponent(room);}
