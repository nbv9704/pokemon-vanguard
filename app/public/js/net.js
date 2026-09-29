// Browser connection. A socket OPEN is not proof that join completed or data saved.
const TERMINAL_CLOSE_CODES=new Set([4001,4003,4401,4403]);
const ACTION_ID=/^[A-Za-z0-9:_-]{1,128}$/;
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const plainObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);

/**
 * Validate the wire envelope before passing it to UI callbacks. This does NOT
 * trust the nested battle/save view; each view version owns its own contract.
 * @param {unknown} raw
 * @returns {import('./types/browser-contracts.d.ts').ServerEnvelope|null}
 */
export function parseServerEnvelope(raw){
 if(!plainObject(raw))return null;
 if(raw.type==='state'){
  if(!plainObject(raw.view))return null;
  return /** @type {import('./types/browser-contracts.d.ts').ServerEnvelope} */(/** @type {unknown} */(raw));
 }
 if(raw.type==='error'){
  if(typeof raw.error!=='string'||raw.error.length>512)return null;
  if(raw.actionId!==undefined&&(typeof raw.actionId!=='string'||!ACTION_ID.test(raw.actionId)))return null;
  return /** @type {import('./types/browser-contracts.d.ts').ServerEnvelope} */(/** @type {unknown} */(raw));
 }
 if(raw.type==='action-ack'){
  if(typeof raw.actionId!=='string'||!ACTION_ID.test(raw.actionId)||typeof raw.actionType!=='string'||raw.actionType.length<1||raw.actionType.length>100)return null;
  if(raw.duplicate!==undefined&&typeof raw.duplicate!=='boolean')return null;
  if(raw.committedRevision!==undefined&&(typeof raw.committedRevision!=='number'||!Number.isSafeInteger(raw.committedRevision)||raw.committedRevision<0))return null;
  if(raw.authoritativeRevision!==undefined&&(typeof raw.authoritativeRevision!=='number'||!Number.isSafeInteger(raw.authoritativeRevision)||raw.authoritativeRevision<0))return null;
  if(raw.commitStatus!==undefined&&(typeof raw.commitStatus!=='string'||!['committed','session'].includes(raw.commitStatus)))return null;
  return /** @type {import('./types/browser-contracts.d.ts').ServerEnvelope} */(/** @type {unknown} */(raw));
 }
 return null;
}

export class AdventureConnection{
 /** @param {import('./types/browser-contracts.d.ts').ConnectionOptions} options */
 constructor({url,playerId,WebSocketImpl,onState,onError,onStatus,onActionAck,onFatal,reconnect=true,pingMs=30000,pongTimeoutMs=10000,joinTimeoutMs=12000,random=Math.random}){
  this.url=url;this.playerId=playerId;this.WebSocketImpl=WebSocketImpl;this.onState=onState;this.onError=onError;this.onStatus=onStatus;this.onActionAck=onActionAck;this.onFatal=onFatal;
  this.reconnect=reconnect;this.random=random;this.pingMs=pingMs;this.pongTimeoutMs=Math.max(50,Number(pongTimeoutMs)||10000);this.joinTimeoutMs=Math.max(50,Number(joinTimeoutMs)||12000);
  /** @type {import('./types/browser-contracts.d.ts').SocketLike|null} */this.socket=null;
  /** @type {ReturnType<typeof setTimeout>|null} */this.reconnectTimer=null;
  /** @type {ReturnType<typeof setInterval>|null} */this.pingTimer=null;
  /** @type {ReturnType<typeof setTimeout>|null} */this.pongTimer=null;
  /** @type {ReturnType<typeof setTimeout>|null} */this.joinTimer=null;
  this.retry=0;this.stopped=true;this.joined=false;this.awaitingPong=false;
 }
 get connected(){return this.socket?.readyState===(this.WebSocketImpl.OPEN??1);}
 start(){if(!this.stopped)return;this.stopped=false;this.open();this.pingTimer=setInterval(()=>this.heartbeat(),this.pingMs);}
 clearPongWatch(){this.awaitingPong=false;if(this.pongTimer!==null)clearTimeout(this.pongTimer);this.pongTimer=null;}
 clearJoinWatch(){if(this.joinTimer!==null)clearTimeout(this.joinTimer);this.joinTimer=null;}
 markAlive(){this.clearPongWatch();}
 heartbeat(){const socket=this.socket;if(!socket||socket.readyState!==(this.WebSocketImpl.OPEN??1)||this.awaitingPong)return;this.awaitingPong=true;socket.send('__ping');this.pongTimer=setTimeout(()=>this.handleHeartbeatTimeout(socket),this.pongTimeoutMs);}
 scheduleReconnect(){
  if(this.stopped||!this.reconnect||this.reconnectTimer!==null)return;
  const jitter=Math.max(0,Math.min(1,Number(this.random())||0)),base=Math.min(15000,700*2**this.retry++),delay=Math.round(base*(.8+.4*jitter));
  this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.open();},delay);
 }
 /** @param {import('./types/browser-contracts.d.ts').SocketLike} socket @param {string} reason */
 disconnectUnhealthy(socket,reason){
  if(socket!==this.socket||this.stopped)return;
  this.clearPongWatch();this.clearJoinWatch();this.joined=false;this.socket=null;this.onStatus?.(false);
  try{socket.close(4000,reason);}catch{}this.scheduleReconnect();
 }
 /** @param {import('./types/browser-contracts.d.ts').SocketLike} socket */
 handleHeartbeatTimeout(socket){if(this.awaitingPong)this.disconnectUnhealthy(socket,'heartbeat timeout');}
 /** @param {import('./types/browser-contracts.d.ts').SocketLike} socket */
 handleJoinTimeout(socket){if(!this.joined)this.disconnectUnhealthy(socket,'join timeout');}
 open(){
  if(this.stopped)return;
  if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);this.reconnectTimer=null;this.clearPongWatch();this.clearJoinWatch();this.joined=false;
  const socket=this.socket=new this.WebSocketImpl(this.url);
  socket.onopen=()=>{
   if(socket!==this.socket||this.stopped)return;this.markAlive();this.onStatus?.(true);
   socket.send(JSON.stringify({type:'join',playerId:this.playerId}));
   this.joinTimer=setTimeout(()=>this.handleJoinTimeout(socket),this.joinTimeoutMs);
  };
  socket.onmessage=event=>{
   if(socket!==this.socket)return;this.markAlive();if(event.data==='__pong')return;
   let raw;try{if(typeof event.data!=='string')return;raw=JSON.parse(event.data);}catch{return;}
   const message=parseServerEnvelope(raw);if(!message)return;
   if(message.type==='error'){this.onError?.(message.error,message);return;}
   if(message.type==='action-ack'){this.onActionAck?.(message);return;}
   if(message.type==='state'){
    if(!this.joined){this.joined=true;this.retry=0;this.clearJoinWatch();}
    this.onState?.(message.view,message);
   }
  };
  socket.onerror=()=>{};
  socket.onclose=event=>{
   if(socket!==this.socket)return;this.clearPongWatch();this.clearJoinWatch();this.joined=false;this.socket=null;this.onStatus?.(false);
   if(TERMINAL_CLOSE_CODES.has(event?.code)){this.stopped=true;if(this.pingTimer!==null)clearInterval(this.pingTimer);this.onFatal?.(event.code);return;}
   this.scheduleReconnect();
  };
 }
 /** @param {import('./types/browser-contracts.d.ts').ActionRequest} action */
 sendAction(action){if(!this.connected||!this.joined||!action||typeof action.type!=='string')return false;this.socket?.send(JSON.stringify({type:'action',action}));return true;}
 stop(){this.stopped=true;if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);if(this.pingTimer!==null)clearInterval(this.pingTimer);this.clearPongWatch();this.clearJoinWatch();this.joined=false;const socket=this.socket;this.socket=null;socket?.close();}
}
/** @param {{protocol:string,host:string}} locationLike @param {string} room */
export function websocketUrl(locationLike,room){return (locationLike.protocol==='https:'?'wss:':'ws:')+'//'+locationLike.host+'/ws/'+encodeURIComponent(room);}
