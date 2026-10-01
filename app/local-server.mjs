import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {JsonAdventureStorage} from './server/storage-json.mjs';
import {HybridAdventureStorage,SupabaseAdventureStorage} from './server/storage-supabase.mjs';
import {publicV2Catalog,v2Catalog} from './server/v2-catalog.mjs';
import {publicV3Catalog,v3Catalog} from './server/v3-catalog.mjs';
import {createServerClock} from './server/clock.mjs';
import {ensureEconomyState} from './server/v2-economy-ledger.mjs';
import {createLocalAuth} from './server/local-auth.mjs';
import {RankedService} from './server/ranked-v1.mjs';
import {SocialService} from './server/social-v1.mjs';
import {TrainingPvpService} from './server/training-pvp-v1.mjs';
import {AdminService} from './server/admin-service.mjs';
import {AccountCoordinator} from './server/account-coordinator.mjs';
import {createRequestQuotas} from './server/request-quotas.mjs';
import {pruneDetachedRooms,roomResourceSnapshot,DETACHED_ROOM_RETENTION_MS} from './server/room-lifecycle.mjs';
import {createCatalogHttpResponse,createStaticHttpResponse} from './server/http-public-assets.mjs';
import {createPublicOriginPolicy} from './server/public-origin-policy.mjs';
import {createHttpRequestHandler} from './server/http-request-handler.mjs';
import {createWebsocketController} from './server/websocket-controller.mjs';
import {RuntimeMetrics,instrumentPersistence} from './server/runtime-metrics.mjs';
import {OperationsJournal,ReadinessGate,settlementHealth,operationalAlerts} from './server/operational-observability.mjs';
import {assertStoragePort} from './server/storage-port.mjs';
import {FileSessionRevocationStore} from './server/session-revocation-store.mjs';
import {SessionCommitContext} from './server/session-commit-context.mjs';
import {PvpRestartRecovery} from './server/pvp-restart-recovery.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export const BETA_TEST_WALLET=Object.freeze({coins:999999,crystals:999999,recruitmentTickets:999});
export function assertSingleCoordinatorEnv(env={}){
 const raw=env.PV_GAME_COORDINATOR_COUNT;if(raw===undefined)return 1;const value=Number(raw);
 if(!Number.isSafeInteger(value)||value!==1)throw new Error('PV_GAME_COORDINATOR_COUNT must be 1; beta PvP does not support multiple live coordinators');return value;
}
export function ensureBetaTestWallet(state){
  if(!state?.progressionV3)return false;
  ensureEconomyState(state);let changed=false;
  for(const [currency,floor] of Object.entries(BETA_TEST_WALLET))if(state.wallet[currency]<floor){state.wallet[currency]=floor;changed=true;}
  state.coins=state.wallet.coins;state.gems=state.wallet.crystals;state.recruitmentTickets=state.wallet.recruitmentTickets;
  if(state.betaTestWalletVersion!==1){state.betaTestWalletVersion=1;changed=true;}
  return changed;
}

export function createLocalServer({ saveDir = path.join(root, '.local-data'), clock = createServerClock(), betaTestFunds = false, authRequired = false, authEnv = process.env, authFetch = fetch, storageFetch = fetch, websocketHeartbeatMs = 10_000, websocketJoinDeadlineMs = 12_000, maxSocketsPerAccount = 4, maxSocketsPerIp = 24, maxResidentRooms = 1000, requestRateLimits = {}, roomRetentionMs = DETACHED_ROOM_RETENTION_MS, shutdownDeadlineMs = 10_000, readinessProbe = null, opsWrite = ()=>{} } = {}) {
  const rooms = new Map();
  const accounts=new AccountCoordinator();
  const runtimeMetrics=new RuntimeMetrics();
  const ops=new OperationsJournal({now:()=>clock.now(),write:opsWrite});
  let auth=null;
  const sessionCommits=new SessionCommitContext({authorize:session=>auth.sessionStatus(session)});
  let broadcast=()=>{},wsController=null;
  function closeAuthSocket(...args){return wsController?.closeAuthSocket(...args);}
  const storage = instrumentPersistence(assertStoragePort(new HybridAdventureStorage({local:new JsonAdventureStorage(saveDir),remote:new SupabaseAdventureStorage({url:authEnv.SUPABASE_URL,secretKey:authEnv.SUPABASE_SECRET_KEY||authEnv.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:storageFetch})})),runtimeMetrics,['save','savePair','restore'],failure=>{ops.record({domain:'storage',outcome:'error',...failure});},success=>{ops.record({domain:'storage',outcome:'ok',...success});},()=>sessionCommits.beforeCommit());
  const requestPolicy=createPublicOriginPolicy({env:authEnv});
  const defaultProbe=async(signal)=>{
   if(authRequired&&!storage.remote.configured)return false;
   // Exercise the configured data provider, not only the process or localhost.
   // Never fetch player saves and never write a probe record.
   if(storage.remote.configured){const response=await storage.remote.request('profiles?select=user_id&limit=1',{signal});await response.json();return true;}
   await storage.local.load('__pv_readiness__');return true;
  };
  const readiness=new ReadinessGate({probe:readinessProbe||defaultProbe,now:()=>clock.now(),onFailure:info=>ops.record({domain:'readiness',operation:'probe',outcome:'error',errorCode:'STORAGE_NOT_READY',...info})});
  const revocationStore=new FileSessionRevocationStore({filePath:path.join(path.resolve(saveDir),'.auth','session-revocations.json'),now:()=>clock.now()});
  auth=createLocalAuth({env:authEnv,fetchImpl:authFetch,requireSessionSecret:authRequired,now:()=>clock.now(),revocationStore,originAllowed:(req,url)=>requestPolicy.browserMutationAllowed(req,url),onLogout:session=>{
   for(const room of rooms.values())for(const ws of new Set([...room.clients.keys(),...(room.pendingSockets||[])]))if(ws.authSessionId===session.sid)closeAuthSocket(ws,'AUTH_REVOKED');
  }});
  const quotas=createRequestQuotas({now:()=>clock.now(),limits:requestRateLimits});
  const notifyAccounts=accountIds=>{for(const accountId of new Set(accountIds||[])){const target=rooms.get(accountId);if(target?.state)broadcast(target);}};
  const setLiveState=(accountId,state)=>{const target=rooms.get(accountId);if(target){target.state=state;target.dirty=false;target.lastActiveAt=clock.now();}};
  const loadState=(accountId,key)=>key?storage.loadForAction(accountId,key):storage.load(accountId);
  let ranked;
  const restartRecovery=new PvpRestartRecovery({loadState:accountId=>storage.load(accountId),persistPair:(entries,operationId)=>storage.savePair(entries,operationId),publishState:setLiveState,withAccounts:(ids,work)=>accounts.withAccounts(ids,work),isMatchLive:matchId=>ranked?.matches.has(matchId)===true,clock});
  const social=new SocialService({clock,getState:accountId=>rooms.get(accountId)?.state||null,loadState,loadProfile:accountId=>storage.profile(accountId),persistPair:(entries,operationId)=>storage.savePair(entries,operationId),setLiveState,notify:notifyAccounts,withAccounts:(ids,work)=>accounts.withAccounts(ids,work)});
  ranked=new RankedService({catalog:v3Catalog,clock,getState:accountId=>rooms.get(accountId)?.state||null,loadState,persist:async(accountId,state)=>storage.save(accountId,state),persistPair:(entries,operationId)=>storage.savePair(entries,operationId),publishState:setLiveState,notify:notifyAccounts,withAccounts:(ids,work)=>accounts.withAccounts(ids,work),restartRecovery,onSettlementFailure:failure=>ops.record({domain:'ranked',operation:'settlement',outcome:'error',...failure})});
  const trainingPvp=new TrainingPvpService({catalog:v3Catalog,clock,getState:accountId=>rooms.get(accountId)?.state||null,notify:notifyAccounts,isFriend:(a,b)=>social.isFriend(a,b),withAccounts:(ids,work)=>accounts.withAccounts(ids,work)});
  const roomLimit=Number.isSafeInteger(maxResidentRooms)?Math.max(1,Math.min(100_000,maxResidentRooms)):1000,roomCounters={ttl:0,capacity:0,capacityRejected:0};
  const roomBusy=id=>ranked.busy(id)||trainingPvp.busy(id);
  const onRoomEvict=(id,reason)=>{roomCounters[reason]=(roomCounters[reason]||0)+1;ranked.presence.delete(id);trainingPvp.presence.delete(id);social.presence.delete(id);};
  const sweepRooms=targetSize=>pruneDetachedRooms(rooms,{now:clock.now(),retentionMs:roomRetentionMs,targetSize,isBusy:roomBusy,onEvict:onRoomEvict});
  const resourceSnapshot=()=>{
   const roomStats=roomResourceSnapshot(rooms,{maxRooms:roomLimit,counters:roomCounters,isBusy:roomBusy});
   const runtime=runtimeMetrics.snapshot(),settlement=settlementHealth(ranked.matches.values(),clock.now());
   return {...roomStats,runtime,settlement,alerts:operationalAlerts({runtime,rooms:roomStats,settlement}),operations:ops.snapshot()};
  };
  let lifecycleTicking=false,lastRoomSweep=clock.now();
  const lifecycleTimer=setInterval(()=>{if(lifecycleTicking)return;lifecycleTicking=true;Promise.resolve().then(()=>ranked.tick()).then(()=>trainingPvp.tick()).then(()=>{
   const now=clock.now();if(now-lastRoomSweep<60_000)return;lastRoomSweep=now;quotas.prune();
   sweepRooms(roomLimit);
  }).catch(error=>{ops.record({domain:'lifecycle',operation:'tick',outcome:'error',errorCode:error?.code});console.error('PvP lifecycle tick failed [redacted]');}).finally(()=>{lifecycleTicking=false;});},1000);
  lifecycleTimer.unref?.();
  let eventLoopExpected=performance.now()+1000;const eventLoopTimer=setInterval(()=>{const measured=performance.now();runtimeMetrics.observeEventLoopLag(Math.max(0,measured-eventLoopExpected));eventLoopExpected=measured+1000;},1000);eventLoopTimer.unref?.();
  const pveLive=()=>[...rooms.entries()].flatMap(([accountId,room])=>{const v3=room.state?.battleV3,v2=room.state?.battleV2;if(v3&&v3.phase!=='FINISHED')return [{kind:'pve',id:v3.id||`pve:${accountId}`,accountId,name:room.state.owner||accountId,mode:v3.mode||'single',status:v3.phase,difficulty:v3.difficulty||'normal'}];if(v2&&v2.phase!=='FINISHED')return [{kind:'pve-v2',id:v2.id||`pve-v2:${accountId}`,accountId,name:room.state.owner||accountId,mode:v2.mode||'single',status:v2.phase,difficulty:v2.difficulty||'normal'}];return [];});
  const liveOperations={
    overview:async()=>({ranked:ranked.adminOverview(),friendly:trainingPvp.adminOverview(),pve:pveLive(),resources:resourceSnapshot()}),
    diagnostics:()=>({...resourceSnapshot(),operations:ops.snapshot({includeRecent:true})}),
    statusForPlayer:accountId=>{const rankedLive=ranked.adminOverview(),queued=rankedLive.queue.find(entry=>entry.accountId===accountId),match=rankedLive.matches.find(entry=>entry.players.some(player=>player.accountId===accountId));if(match)return match;if(queued)return queued;const friendly=trainingPvp.adminOverview().rooms.find(entry=>entry.players.some(player=>player.accountId===accountId));if(friendly)return friendly;return pveLive().find(entry=>entry.accountId===accountId)||null;},
    accountIdsForPlayer:accountId=>[...new Set([...ranked.accountIdsForPlayer(accountId),...trainingPvp.accountIdsForPlayer(accountId)])],
    stopForPlayer:async(accountId,reason)=>{const rankedStop=await ranked.adminStopUnlocked(accountId,reason);if(rankedStop.ok)return rankedStop;const friendlyStop=trainingPvp.adminStopUnlocked(accountId,reason);if(friendlyStop.ok)return friendlyStop;return {ok:false,code:'NO_EXTERNAL_BATTLE_ACTIVITY'};}
  };
  const admin=new AdminService({storage,catalog:v3Catalog,clock,isAdmin:session=>auth.isAdmin(session),originAllowed:(req,url)=>requestPolicy.browserMutationAllowed(req,url),isOnline:accountId=>(rooms.get(accountId)?.clients.size||0)>0,listOnlineAccountIds:()=>[...rooms.entries()].filter(([,room])=>room.clients.size>0).map(([accountId])=>accountId),getLiveState:accountId=>rooms.get(accountId)?.state||null,setLiveState,notify:notifyAccounts,disconnect:(accountId,code)=>{const target=rooms.get(accountId);if(!target)return;for(const ws of target.clients.keys()){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'error',error:code}));ws.close(4003,code==='ACCOUNT_SUSPENDED'?'account suspended':'admin disconnect');}},withAccountLock:(accountId,work)=>accounts.withAccounts([accountId],work),withAccountsLock:(ids,work)=>accounts.withAccounts(ids,work),liveOperations,backupDir:path.join(path.resolve(saveDir),'.admin-backups')});
  const migrationBackups=path.join(path.resolve(saveDir),'.migration-backups');
  const publicDir = path.join(root, 'public');
  const serveV2Catalog=createCatalogHttpResponse(publicV2Catalog);
  const serveV3Catalog=createCatalogHttpResponse(publicV3Catalog);
  const serveStatic=createStaticHttpResponse(publicDir);
  const handleHttp=createHttpRequestHandler({isClosing:()=>closing,readiness,requestPolicy,auth,admin,sessionCommits,
   quotas,v2Catalog,serveV2Catalog,serveV3Catalog,serveStatic});
  const server=http.createServer((req,res)=>{void handleHttp(req,res);});
  wsController=createWebsocketController({server,isClosing:()=>closing,requestPolicy,auth,authRequired,quotas,rooms,sweepRooms,roomLimit,roomCounters,clock,runtimeMetrics,accounts,ranked,social,trainingPvp,restartRecovery,storage,migrationBackups,v2Catalog,v3Catalog,betaTestFunds,ensureBetaTestWallet,ops,sessionCommits,websocketHeartbeatMs,websocketJoinDeadlineMs,maxSocketsPerIp,maxSocketsPerAccount,setBroadcast:next=>{broadcast=next;}});
  const {wss,websocketHeartbeatTimer,sessionSweepTimer}=wsController;
  let closePromise=null,closing=false;
  const bounded=async(promise,ms)=>{let timer;try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(resolve,ms);timer.unref?.();})]);}finally{clearTimeout(timer);}};
  return {
    server,
    resourceSnapshot,
    readiness,
    operations:ops,
    listen: (port = 3100) => new Promise((resolve,reject) => {server.once('error',reject); server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port);});}),
    close: async () => closePromise||(closePromise=(async()=>{closing=true;clearInterval(lifecycleTimer);clearInterval(eventLoopTimer);clearInterval(websocketHeartbeatTimer);clearInterval(sessionSweepTimer);const budget=Number.isSafeInteger(shutdownDeadlineMs)?Math.max(100,Math.min(60_000,shutdownDeadlineMs)):10_000,endsAt=Date.now()+budget,remaining=()=>Math.max(1,endsAt-Date.now());const serverClosed=!server.listening?Promise.resolve():new Promise(resolve=>server.close(()=>resolve()));for(const ws of wss.clients)ws.close(1001,'server shutting down');await bounded(Promise.all([...rooms.values()].map(r=>r.queue.idle())),remaining());for(const ws of wss.clients)ws.terminate();await bounded(new Promise(resolve=>wss.close(resolve)),remaining());server.closeAllConnections?.();await bounded(serverClosed,remaining());})())
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envLimit=(name,defaultValue,min=1,max=100_000)=>{const raw=process.env[name];if(raw===undefined)return defaultValue;const value=Number(raw);if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`Invalid integer configuration: ${name}`);return value;};
  assertSingleCoordinatorEnv(process.env);
  const app = createLocalServer({betaTestFunds:process.env.BETA_TEST_FUNDS==='true',authRequired:true,
   shutdownDeadlineMs:envLimit('PV_SHUTDOWN_TIMEOUT_MS',10_000,100,60_000),
   maxSocketsPerIp:envLimit('PV_WS_MAX_SOCKETS_PER_IP',24,1,256),
   maxResidentRooms:envLimit('PV_MAX_RESIDENT_ROOMS',1000,1,100_000),
   opsWrite:process.env.PV_OPS_JSON_LOG==='true'?entry=>process.stdout.write(JSON.stringify(entry)+'\n'):()=>{},
   requestRateLimits:{accountActions:envLimit('PV_RATE_ACCOUNT_ACTIONS_10S',45),ipActions:envLimit('PV_RATE_IP_ACTIONS_10S',180),socketMessages:envLimit('PV_RATE_SOCKET_MESSAGES_10S',70),ipUpgrades:envLimit('PV_RATE_IP_UPGRADES_MIN',30),httpInspector:envLimit('PV_RATE_INSPECTOR_MIN',40)}});
  const port = await app.listen(Number(process.env.PORT || 3100));
  console.log(`Pokémon Vanguard: http://localhost:${port}\nAccount saves: Supabase when configured; local storage is development-only.\nEdit public files and refresh the browser. Rule changes restart in watch mode.`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void app.close().then(()=>process.exit(0),error=>{console.error('Graceful shutdown failed:',error.message);process.exitCode=1;});});
}
