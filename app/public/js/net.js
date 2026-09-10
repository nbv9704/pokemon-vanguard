export class AdventureConnection{
 constructor({url,playerId,WebSocketImpl,onState,onError,onStatus,reconnect=true,pingMs=30000}){
  this.url=url;this.playerId=playerId;this.WebSocketImpl=WebSocketImpl;this.onState=onState;this.onError=onError;this.onStatus=onStatus;
  this.reconnect=reconnect;this.pingMs=pingMs;this.socket=null;this.retry=0;this.stopped=true;this.reconnectTimer=null;this.pingTimer=null;
 }
 get connected(){return this.socket?.readyState===(this.WebSocketImpl.OPEN??1);}
 start(){if(!this.stopped)return;this.stopped=false;this.open();this.pingTimer=setInterval(()=>{if(this.connected)this.socket.send('__ping');},this.pingMs);}
 open(){
  if(this.stopped)return;
  const socket=this.socket=new this.WebSocketImpl(this.url);
  socket.onopen=()=>{if(socket!==this.socket||this.stopped)return;this.retry=0;this.onStatus?.(true);socket.send(JSON.stringify({type:'join',playerId:this.playerId}));};
  socket.onmessage=event=>{
   if(socket!==this.socket||event.data==='__pong')return;
   let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message?.type==='error'){this.onError?.(message.error);return;}
   if(message?.type==='state'&&message.view)this.onState?.(message.view,message);
  };
  socket.onerror=()=>{};
  socket.onclose=()=>{
   if(socket!==this.socket)return;
   this.onStatus?.(false);
   if(this.stopped||!this.reconnect)return;
   const delay=Math.min(15000,700*2**this.retry++);
   this.reconnectTimer=setTimeout(()=>this.open(),delay);
  };
 }
 sendAction(action){if(!this.connected)return false;this.socket.send(JSON.stringify({type:'action',action}));return true;}
 stop(){this.stopped=true;clearTimeout(this.reconnectTimer);clearInterval(this.pingTimer);this.socket?.close();}
}

export function websocketUrl(locationLike,room){return (locationLike.protocol==='https:'?'wss:':'ws:')+'//'+locationLike.host+'/ws/'+encodeURIComponent(room);}

