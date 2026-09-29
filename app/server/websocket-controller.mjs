// Transport and WebSocket session lifecycle live here. The composition root
// supplies account/storage services without allowing this module to own them.
import {WebSocketServer,WebSocket} from 'ws';
import {setup} from '../src/logic.js';
import {upgradeAdventure} from './v2-release.mjs';
import {upgradeAdventureToV3} from './v3-release.mjs';
import {prepareRecruitmentState} from './v2-recruitment-state.mjs';
import {prepareV3RecruitmentState} from './v3-recruitment-state.mjs';
import {ensureRankedState} from './ranked-v1.mjs';
import {ensureSocialState} from './social-v1.mjs';
import {ensureMissionState} from './missions.mjs';
import {ensureAdminGiftState} from './admin-gifts.mjs';
import {ensureMailboxState} from './mailbox-v1.mjs';
import {reconcileV3BattlePresentation} from './v3-battle-session.mjs';
import {SerialTaskQueue} from './serial-task-queue.mjs';
import {markWebSocketAlive,startWebSocketHeartbeat} from './websocket-heartbeat.mjs';
import {createInboundLimiter,sendBounded,sendSerializedBounded} from './ws-flow-control.mjs';
import {createDeltaStateBroadcaster} from './state-broadcast.mjs';
import {createPlayerStateProjector} from './public-state-projector.mjs';
import {createPlayerActionDispatcher} from './player-action-dispatch.mjs';

export function createWebsocketController({server,isClosing,requestPolicy,auth,authRequired,quotas,
 rooms,sweepRooms,roomLimit,roomCounters,clock,runtimeMetrics,accounts,ranked,social,
 trainingPvp,storage,migrationBackups,v2Catalog,v3Catalog,betaTestFunds,
 ensureBetaTestWallet,ops,sessionCommits,websocketHeartbeatMs,websocketJoinDeadlineMs,
 maxSocketsPerIp,maxSocketsPerAccount,setBroadcast}){
  let broadcast=()=>{};
  const wss = new WebSocketServer({ noServer:true, maxPayload:70 * 1024 });
  function closeAuthSocket(ws,error='AUTH_EXPIRED'){if(ws.readyState===WebSocket.OPEN)sendBounded(ws,{type:'error',error},{openState:WebSocket.OPEN});const reason=error==='AUTH_REVOKED'?'session revoked':error==='AUTH_REVOCATION_STORE_UNAVAILABLE'?'session unavailable':'session expired';ws.close(4001,reason);}
  const joinDeadlineMs=Number.isSafeInteger(websocketJoinDeadlineMs)?Math.max(50,Math.min(60_000,websocketJoinDeadlineMs)):12_000;
  const maxIpSockets=Number.isSafeInteger(maxSocketsPerIp)?Math.max(1,Math.min(256,maxSocketsPerIp)):24;
  const maxAccountSockets=Number.isSafeInteger(maxSocketsPerAccount)?Math.max(1,Math.min(16,maxSocketsPerAccount)):4;
  const websocketHeartbeatTimer=startWebSocketHeartbeat(wss,{intervalMs:websocketHeartbeatMs});
  server.on('upgrade', (req, socket, head) => {void (async()=>{
    if(isClosing()){socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');return;}
    let match,validOrigin,session=null;
    try{match=/^\/ws\/([A-Za-z0-9_-]{1,135})$/.exec(new URL(req.url,'http://localhost').pathname);validOrigin=requestPolicy.originAllowed(req,requestPolicy.requestUrl(req),{allowMissing:true});session=await auth.authenticate(req);}
    catch{socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');return;}
    if(!match||!validOrigin||authRequired&&!session){socket.end(`HTTP/1.1 ${match&&validOrigin&&authRequired&&!session?'401 Unauthorized':'403 Forbidden'}\r\n\r\n`);return;}
    if(session&&match[1]!==session.roomId){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const remoteIp=requestPolicy.clientIp(req),quota=quotas.upgrade(remoteIp);
    if(!quota.ok){socket.end('HTTP/1.1 429 Too Many Requests\r\nRetry-After: '+Math.max(1,Math.ceil(quota.retryAfterMs/1000))+'\r\n\r\n');return;}
    if([...wss.clients].filter(client=>client.remoteIp===remoteIp).length>=maxIpSockets){socket.end('HTTP/1.1 429 Too Many Requests\r\n\r\n');return;}
    if(!rooms.has(match[1])){sweepRooms(roomLimit-1);if(rooms.size>=roomLimit){roomCounters.capacityRejected++;socket.end('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 5\r\n\r\n');return;}}
    wss.handleUpgrade(req,socket,head,ws=>{ws.remoteIp=remoteIp;wss.emit('connection',ws,{name:match[1],session});});
  })().catch(()=>socket.destroy());});
  const onSocketDrop=reason=>runtimeMetrics.observeSocketDrop(reason);
  const send = (ws, message) => sendBounded(ws,message,{openState:WebSocket.OPEN,onDrop:onSocketDrop});
  const sendFrame=(ws,encoded)=>sendSerializedBounded(ws,encoded,{openState:WebSocket.OPEN,onDrop:onSocketDrop});
  const dispatchPlayerAction=createPlayerActionDispatcher({accounts,ranked,social,trainingPvp,storage,migrationBackups,v2Catalog,v3Catalog,clock,persist,broadcast:room=>broadcast(room),send});
  const inbound=createInboundLimiter();
  const projectPlayerState=createPlayerStateProjector({clock,ranked,trainingPvp,social});
  const stateBroadcaster=createDeltaStateBroadcaster();
  let sessionSweepActive=false;
  const sessionSweepTimer=setInterval(()=>{if(sessionSweepActive)return;sessionSweepActive=true;Promise.all([...wss.clients].map(async ws=>{
   if(!ws.authSession||ws.readyState!==WebSocket.OPEN)return;try{const status=await auth.sessionStatus(ws.authSession);if(!status.active)closeAuthSocket(ws,status.reason==='revoked'?'AUTH_REVOKED':'AUTH_EXPIRED');}catch{closeAuthSocket(ws,'AUTH_REVOCATION_STORE_UNAVAILABLE');}
  })).catch(()=>{}).finally(()=>{sessionSweepActive=false;});},1000);sessionSweepTimer.unref?.();
  broadcast = room => {
   const stats=stateBroadcaster.broadcast(room.clients,{project:player=>projectPlayerState(room,player),send:sendFrame,supportsDelta:socket=>socket.stateDeltaV1===true});
   runtimeMetrics.observeBroadcast(stats);
  };
  setBroadcast(broadcast);
  async function persist(name, state) {
    await storage.save(name,state);
  }
  wss.on('connection', (ws, identity) => {
    const {name,session}=identity;
    ws.authSessionId=session?.sid||null;
    ws.authSession=session||null;
    if(session&&!auth.sessionValid(session)){closeAuthSocket(ws);return;}
    const roomExisting=rooms.get(name);
    if(roomExisting&&(roomExisting.clients.size+(roomExisting.pendingSockets?.size||0))>=maxAccountSockets){ws.close(1013,'too many account sockets');return;}
    const expiryMs=session?Math.max(1,session.exp*1000-clock.now()):null;
    const expiryTimer=expiryMs===null?null:setTimeout(()=>closeAuthSocket(ws),Math.min(expiryMs,2**31-1));expiryTimer?.unref?.();
    const joinTimer=setTimeout(()=>{if(!ws.joinedToRoom&&ws.readyState===WebSocket.OPEN)ws.close(4000,'join deadline exceeded');},joinDeadlineMs);joinTimer.unref?.();
    markWebSocketAlive(ws);
    if (!rooms.has(name)) rooms.set(name, { name, state:null, clients:new Map(), pendingSockets:new Set(), queue:new SerialTaskQueue({now:()=>clock.now()}), dirty:false, lastActiveAt:clock.now(), lastDetachedAt:null });
    const room = rooms.get(name);room.pendingSockets.add(ws);room.lastActiveAt=clock.now();
    ws.on('error', () => {});
    ws.on('message', raw => {
      room.lastActiveAt=clock.now();
      // Budget pings as well as actions, before parsing or queueing expensive work.
      const messageQuota=quotas.message({accountId:name,ip:ws.remoteIp||'unknown',socket:ws});
      if(!messageQuota.ok){const retryAfterMs=messageQuota.retryAfterMs;send(ws,{type:'error',error:'ACTION_RATE_LIMITED',retryAfterMs});return;}
      if (raw.toString() === '__ping') { if(ws.bufferedAmount>8*1024*1024)ws.terminate();else ws.send('__pong'); return; }
      if(!inbound.acquire(ws)){ws.close(1013,'too many queued actions');return;}
      room.queue.run(() => sessionCommits.run(session,async () => {
        if(session){const status=await auth.sessionStatus(session);if(!status.active){closeAuthSocket(ws,status.reason==='revoked'?'AUTH_REVOKED':'AUTH_EXPIRED');return;}}
        let message;
        const fail = error => send(ws, {type:'error',error,...(typeof message?.action?.actionId==='string'&&message.action.actionId.length<=128?{actionId:message.action.actionId}:{})});
        try { message = JSON.parse(raw.toString()); } catch { return fail('invalid json'); }
        if (!message || typeof message !== 'object' || Array.isArray(message)) return fail('expected a json object');
        if (message.type === 'join') {
          if (typeof message.playerId !== 'string' || !message.playerId.trim() || message.playerId.length > 128) return fail('playerId required');
          if(session&&message.playerId!==session.playerId)return fail('AUTH_IDENTITY_MISMATCH');
          if (room.clients.has(ws)) return fail('already joined');
          ws.stateDeltaV1=Array.isArray(message.capabilities)&&message.capabilities.includes('state-delta-v1');
          room.dirty=true;
          if (!room.state) {
            const loaded=await storage.load(name);
            if(!loaded){const v2=upgradeAdventure(setup([message.playerId]),v2Catalog),v3=upgradeAdventureToV3(v2.state,v3Catalog);room.state=v3.state;await persist(name,room.state);}
            else if(!loaded.battle){let base=loaded;if((loaded.schemaVersion||1)<2){const v2=upgradeAdventure(loaded,v2Catalog);base=v2.state;}const upgraded=upgradeAdventureToV3(base,v3Catalog);if(['migrated','catalog-upgraded','progression-upgraded'].includes(upgraded.status)){await storage.backup(name,migrationBackups,'pre-v3-schema');room.state=upgraded.state;await persist(name,room.state);}else room.state=upgraded.state;}
            else room.state=loaded;
          }
          if(betaTestFunds)ensureBetaTestWallet(room.state);ensureRankedState(room.state);ensureSocialState(room.state);if((room.state.schemaVersion||1)>=2)prepareRecruitmentState(room.state,v2Catalog,clock.now());if(room.state.progressionV3)prepareV3RecruitmentState(room.state,v3Catalog,clock.now());ensureMissionState(room.state,clock.now(),{login:true});ensureAdminGiftState(room.state);ensureMailboxState(room.state,{now:clock.now()});room.state=reconcileV3BattlePresentation(room.state,v3Catalog).state;await persist(name,room.state);room.dirty=false;
          if(room.state.adminV1?.suspended){send(ws,{type:'error',error:'ACCOUNT_SUSPENDED'});ws.close(4003,'account suspended');return;}
          room.pendingSockets.delete(ws);room.clients.set(ws,message.playerId);ws.joinedToRoom=true;clearTimeout(joinTimer);const identitySession=session||{provider:'local',name:message.playerId};ranked.register(name,identitySession);social.register(name,identitySession);trainingPvp.register(name,identitySession); broadcast(room); return;
        }
        const player = room.clients.get(ws);
        if (!player) return fail('join first');
        if(message.type==='resync'){stateBroadcaster.reset(ws);broadcast(room);return;}
        if (message.type !== 'action') return fail('unknown message type');
        if (player !== room.state.owner) return fail('spectators cannot act');
        if (Buffer.byteLength(JSON.stringify(message.action ?? null)) > 64 * 1024) return fail('action too large');
        return dispatchPlayerAction({ws,name,room,player,session,message,fail});
      })).catch(error => {if(['AUTH_REVOKED','AUTH_EXPIRED','AUTH_REVOCATION_STORE_UNAVAILABLE'].includes(error?.code)){closeAuthSocket(ws,error.code);return;}const operationId=ops.record({domain:'ws-action',operation:'action',outcome:'error',errorCode:error?.code});console.error('Player action failed',operationId);send(ws,{type:'error',error:'Could not save this action. Check the local server terminal.'});}).finally(()=>inbound.release(ws));
    });
    ws.on('close', () => {clearTimeout(joinTimer);clearTimeout(expiryTimer);stateBroadcaster.reset(ws);room.pendingSockets.delete(ws);room.queue.run(() => {room.clients.delete(ws);room.lastActiveAt=clock.now();if(room.clients.size===0){room.lastDetachedAt=clock.now();ranked.unregister(name);social.unregister(name);trainingPvp.unregister(name);} if(room.state) broadcast(room);}).catch(error=>{ops.record({domain:'lifecycle',operation:'tick',outcome:'error',errorCode:error?.code});console.error('Socket cleanup failed [redacted]');}); });
  });
  return {wss,websocketHeartbeatTimer,sessionSweepTimer,closeAuthSocket};
}
