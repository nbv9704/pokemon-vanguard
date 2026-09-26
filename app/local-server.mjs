import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { meta, setup, validateAction, applyAction, viewFor } from './src/logic.js';
import { JsonAdventureStorage } from './server/storage-json.mjs';
import {HybridAdventureStorage,SupabaseAdventureStorage} from './server/storage-supabase.mjs';
import { publicV2Catalog, v2Catalog } from './server/v2-catalog.mjs';
import {publicV3Catalog,v3Catalog} from './server/v3-catalog.mjs';
import {applyV3ProgressionAction,v3TrainingView} from './server/v3-progression.mjs';
import {upgradeAdventureToV3} from './server/v3-release.mjs';
import {applyV3BattleAction} from './server/v3-battle-actions.mjs';
import {v3BattleView} from './server/v3-battle-view.mjs';
import { applyV2ProgressionAction, v2TrainingView } from './server/v2-progression.mjs';
import { applyV2BattleAction, v2BattleView } from './server/v2-battle-actions.mjs';
import { applyV2EconomyAction, isV2EconomyAction } from './server/v2-economy.mjs';
import { inspectV2Damage } from './server/v2-damage-inspector.mjs';
import {synchronizeLegacyState,upgradeAdventure} from './server/v2-release.mjs';
import {createServerClock} from './server/clock.mjs';
import {applyV2RecruitmentAction,isV2RecruitmentAction,v2RecruitmentView} from './server/v2-recruitment.mjs';
import {prepareRecruitmentState} from './server/v2-recruitment-state.mjs';
import {applyV3RecruitmentAction,isV3RecruitmentAction,v3RecruitmentView} from './server/v3-recruitment.mjs';
import {prepareV3RecruitmentState} from './server/v3-recruitment-state.mjs';
import {reconcileV3BattleAfterTeamSave,reconcileV3BattlePresentation} from './server/v3-battle-session.mjs';
import {ensureEconomyState} from './server/v2-economy-ledger.mjs';
import {checkoutV3Training} from './server/v3-training-checkout.mjs';
import {createLocalAuth} from './server/local-auth.mjs';
import {applyMissionAction,ensureMissionState,isMissionAction,missionView,recordMissionEvent} from './server/missions.mjs';
import {applyV3ShopAction,isV3ShopAction,v3ShopView} from './server/v3-item-shop.mjs';
import {profileView} from './server/profile-view.mjs';
import {ticketBagView,applyBagAction} from './server/ticket-bag.mjs';
import {ensureRankedState,RankedService} from './server/ranked-v1.mjs';
import {ensureSocialState,SocialService} from './server/social-v1.mjs';
import {TrainingPvpService} from './server/training-pvp-v1.mjs';
import {AdminService} from './server/admin-service.mjs';
import {adminGiftView,applyAdminGiftAction,ensureAdminGiftState,isAdminGiftAction} from './server/admin-gifts.mjs';
import {applyMailboxAction,ensureMailboxState,isMailboxAction,systemMailboxView} from './server/mailbox-v1.mjs';
import {createPokemonUiIconProxy} from './server/pokemon-ui-icons.mjs';
import {markWebSocketAlive,startWebSocketHeartbeat} from './server/websocket-heartbeat.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export const BETA_TEST_WALLET=Object.freeze({coins:999999,crystals:999999,recruitmentTickets:999});
export function ensureBetaTestWallet(state){
  if(!state?.progressionV3)return false;
  ensureEconomyState(state);let changed=false;
  for(const [currency,floor] of Object.entries(BETA_TEST_WALLET))if(state.wallet[currency]<floor){state.wallet[currency]=floor;changed=true;}
  state.coins=state.wallet.coins;state.gems=state.wallet.crystals;state.recruitmentTickets=state.wallet.recruitmentTickets;
  if(state.betaTestWalletVersion!==1){state.betaTestWalletVersion=1;changed=true;}
  return changed;
}
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.gif':'image/gif', '.json':'application/json', '.woff2':'font/woff2' };
async function readJsonBody(req,maxBytes=32*1024){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('Request too large'),{statusCode:413});chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export function createLocalServer({ saveDir = path.join(root, '.local-data'), clock = createServerClock(), betaTestFunds = false, authRequired = false, authEnv = process.env, authFetch = fetch, storageFetch = fetch, websocketHeartbeatMs = 10_000 } = {}) {
  const rooms = new Map();
  let broadcast=()=>{};
  const storage = new HybridAdventureStorage({local:new JsonAdventureStorage(saveDir),remote:new SupabaseAdventureStorage({url:authEnv.SUPABASE_URL,secretKey:authEnv.SUPABASE_SECRET_KEY||authEnv.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:storageFetch})});
  const auth=createLocalAuth({env:authEnv,fetchImpl:authFetch});
  const servePokemonUiIcon=createPokemonUiIconProxy({fetchImpl:authFetch});
  const notifyAccounts=accountIds=>{for(const accountId of new Set(accountIds||[])){const target=rooms.get(accountId);if(target?.state)broadcast(target);}};
  const setLiveState=(accountId,state)=>{const target=rooms.get(accountId);if(target)target.state=state;};
  const social=new SocialService({clock,getState:accountId=>rooms.get(accountId)?.state||null,loadState:accountId=>storage.load(accountId),persist:(accountId,state)=>storage.save(accountId,state),setLiveState,notify:notifyAccounts});
  const ranked=new RankedService({catalog:v3Catalog,clock,getState:accountId=>rooms.get(accountId)?.state||null,persist:async(accountId,state)=>storage.save(accountId,state),notify:notifyAccounts});
  const trainingPvp=new TrainingPvpService({catalog:v3Catalog,clock,getState:accountId=>rooms.get(accountId)?.state||null,notify:notifyAccounts,isFriend:(a,b)=>social.isFriend(a,b)});
  let lifecycleTicking=false;
  const lifecycleTimer=setInterval(()=>{if(lifecycleTicking)return;lifecycleTicking=true;Promise.resolve().then(()=>ranked.tick()).then(()=>trainingPvp.tick()).catch(error=>console.error('PvP lifecycle tick failed:',error.message)).finally(()=>{lifecycleTicking=false;});},1000);
  lifecycleTimer.unref?.();
  const pveLive=()=>[...rooms.entries()].flatMap(([accountId,room])=>{const v3=room.state?.battleV3,v2=room.state?.battleV2;if(v3&&v3.phase!=='FINISHED')return [{kind:'pve',id:v3.id||`pve:${accountId}`,accountId,name:room.state.owner||accountId,mode:v3.mode||'single',status:v3.phase,difficulty:v3.difficulty||'normal'}];if(v2&&v2.phase!=='FINISHED')return [{kind:'pve-v2',id:v2.id||`pve-v2:${accountId}`,accountId,name:room.state.owner||accountId,mode:v2.mode||'single',status:v2.phase,difficulty:v2.difficulty||'normal'}];return [];});
  const liveOperations={
    overview:async()=>({ranked:ranked.adminOverview(),friendly:trainingPvp.adminOverview(),pve:pveLive()}),
    statusForPlayer:accountId=>{const rankedLive=ranked.adminOverview(),queued=rankedLive.queue.find(entry=>entry.accountId===accountId),match=rankedLive.matches.find(entry=>entry.players.some(player=>player.accountId===accountId));if(match)return match;if(queued)return queued;const friendly=trainingPvp.adminOverview().rooms.find(entry=>entry.players.some(player=>player.accountId===accountId));if(friendly)return friendly;return pveLive().find(entry=>entry.accountId===accountId)||null;},
    stopForPlayer:async(accountId,reason)=>{const rankedStop=await ranked.adminStopForPlayer(accountId,reason);if(rankedStop.ok)return rankedStop;const friendlyStop=trainingPvp.adminStopForPlayer(accountId,reason);if(friendlyStop.ok)return friendlyStop;return {ok:false,code:'NO_EXTERNAL_BATTLE_ACTIVITY'};}
  };
  const admin=new AdminService({storage,catalog:v3Catalog,clock,isAdmin:session=>auth.isAdmin(session),isOnline:accountId=>(rooms.get(accountId)?.clients.size||0)>0,listOnlineAccountIds:()=>[...rooms.entries()].filter(([,room])=>room.clients.size>0).map(([accountId])=>accountId),getLiveState:accountId=>rooms.get(accountId)?.state||null,setLiveState,notify:notifyAccounts,disconnect:(accountId,code)=>{const target=rooms.get(accountId);if(!target)return;for(const ws of target.clients.keys()){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'error',error:code}));ws.close(4003,code==='ACCOUNT_SUSPENDED'?'account suspended':'admin disconnect');}},withAccountLock:async(accountId,work)=>{const target=rooms.get(accountId);if(!target)return work();let result;target.queue=target.queue.then(async()=>{result=await work();});await target.queue;return result;},liveOperations,backupDir:path.join(path.resolve(saveDir),'.admin-backups')});
  const migrationBackups=path.join(path.resolve(saveDir),'.migration-backups');
  const publicDir = path.join(root, 'public');
  const server = http.createServer(async (req, res) => {
    try {
      const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(await auth.handle(req,res,url))return;const adminSession=auth.readSession(req);if(await admin.handle(req,res,url,adminSession))return;
      if(await servePokemonUiIcon(req,res,url))return;
      const pathname = decodeURIComponent(url.pathname);
      if(pathname==='/api/v2/damage'){
        if(req.method!=='POST'){res.writeHead(405);return res.end();}
        const result=inspectV2Damage(await readJsonBody(req),v2Catalog);res.writeHead(result.ok?200:400,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(JSON.stringify(result));
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      if (pathname === '/api/v2/catalog') {
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(publicV2Catalog));
      }
      if(pathname==='/api/v3/catalog'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(req.method==='HEAD'?undefined:JSON.stringify(publicV3Catalog));
      }
      const file = path.resolve(publicDir, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(publicDir + path.sep)) { res.writeHead(403); return res.end(); }
      if (!(await stat(file)).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) { res.writeHead(error.statusCode||(error.code === 'ENOENT' ? 404 : 400)); res.end('Not found'); }
  });
  const wss = new WebSocketServer({ noServer:true, maxPayload:70 * 1024 });
  const websocketHeartbeatTimer=startWebSocketHeartbeat(wss,{intervalMs:websocketHeartbeatMs});
  server.on('upgrade', (req, socket, head) => {
    let match, validOrigin = false,session=null;
    try {
      match = /^\/ws\/([A-Za-z0-9_-]{1,64})$/.exec(new URL(req.url, 'http://localhost').pathname);
      validOrigin = !req.headers.origin || new URL(req.headers.origin).host === req.headers.host;
      session=auth.readSession(req);
    } catch {}
    if (!match || !validOrigin || authRequired&&!session) {
      socket.end(`HTTP/1.1 ${authRequired&&!session?'401 Unauthorized':'403 Forbidden'}\r\n\r\n`); return;
    }
    if(session&&match[1]!==session.roomId){
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, {name:match[1],session}));
  });
  const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  broadcast = room => {
    const serverNow=clock.now();
    for (const [ws, player] of room.clients) {
      const legacyView=viewFor(room.state,player);
      const {rngState,rewardReceipts,economyLedger,actionReceipts,ticketBagV1:_privateTicketBagV1,adminV1:_privateAdminV1,adminAuditV1:_privateAdminAuditV1,adminGiftsV1:_privateAdminGiftsV1,missionsV1:_privateMissions,recruitmentV2:_privateRecruitmentV2,recruitmentV3:_privateRecruitmentV3,progressionV3:_privateProgressionV3,legacyV2Archive,clockV2,mons,builds,teams,blueprints,nextMonId,nextBuildId,nextTeamId,nextBlueprintId,...publicAdventure}=legacyView;
      const recruitmentV2=v2RecruitmentView(room.state,v2Catalog,{serverNow}),viewNow=recruitmentV2?.effectiveNow??serverNow;
      const recruitmentV3=v3RecruitmentView(room.state,v3Catalog,{serverNow}),adminGifts=room.state.progressionV3?adminGiftView(room.state,v3Catalog,{now:serverNow}):null,systemMailbox=systemMailboxView(room.state,v2Catalog,{now:serverNow}),mailboxV1={version:1,unreadCount:systemMailbox.unreadCount+(adminGifts?.unreadCount||0),pendingCount:systemMailbox.pendingCount+(adminGifts?.pendingCount||0),system:systemMailbox.mails};
      const view=legacyView.spectator?{spectator:true}:{...publicAdventure,recruitmentTickets:room.state.wallet?.recruitmentTickets||0,missions:missionView(room.state,serverNow),trainingV2:v2TrainingView(room.state,v2Catalog,{now:viewNow}),trainingV3:room.state.progressionV3?v3TrainingView(room.state.progressionV3,v3Catalog):null,bagV1:room.state.progressionV3?ticketBagView(room.state,v3Catalog):null,shopV3:room.state.progressionV3?v3ShopView(room.state,v3Catalog):null,profileV1:room.state.progressionV3?profileView(room.state,v3Catalog,{serverNow}):null,rankedV1:room.state.progressionV3?ranked.viewFor(room.name,room.state):null,trainingPvpV1:room.state.progressionV3?trainingPvp.viewFor(room.name):null,socialV1:room.state.progressionV3?social.viewFor(room.name,room.state):null,mailboxV1,adminGiftsV1:adminGifts,recruitmentV2,recruitmentV3,battleV2:v2BattleView(room.state,v2Catalog),battleV3:v3BattleView(room.state)};
      send(ws, { type:'state', status:'playing', seats:[room.state.owner], you:player, connected:room.clients.size, view, result:null, meta });
    }
  };
  async function persist(name, state) {
    await storage.save(name,state);
  }
  wss.on('connection', (ws, identity) => {
    const {name,session}=identity;
    markWebSocketAlive(ws);
    if (!rooms.has(name)) rooms.set(name, { name, state:null, clients:new Map(), queue:Promise.resolve() });
    const room = rooms.get(name);
    ws.on('error', () => {});
    ws.on('message', raw => {
      if (raw.toString() === '__ping') { ws.send('__pong'); return; }
      room.queue = room.queue.then(async () => {
        const fail = error => send(ws, {type:'error', error});
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return fail('invalid json'); }
        if (!message || typeof message !== 'object' || Array.isArray(message)) return fail('expected a json object');
        if (message.type === 'join') {
          if (typeof message.playerId !== 'string' || !message.playerId.trim() || message.playerId.length > 128) return fail('playerId required');
          if(session&&message.playerId!==session.playerId)return fail('AUTH_IDENTITY_MISMATCH');
          if (room.clients.has(ws)) return fail('already joined');
          if (!room.state) {
            const loaded=await storage.load(name);
            if(!loaded){const v2=upgradeAdventure(setup([message.playerId]),v2Catalog),v3=upgradeAdventureToV3(v2.state,v3Catalog);room.state=v3.state;await persist(name,room.state);}
            else if(!loaded.battle){let base=loaded;if((loaded.schemaVersion||1)<2){const v2=upgradeAdventure(loaded,v2Catalog);base=v2.state;}const upgraded=upgradeAdventureToV3(base,v3Catalog);if(['migrated','catalog-upgraded','progression-upgraded'].includes(upgraded.status)){await storage.backup(name,migrationBackups,'pre-v3-schema');room.state=upgraded.state;await persist(name,room.state);}else room.state=upgraded.state;}
            else room.state=loaded;
          }
          if(betaTestFunds)ensureBetaTestWallet(room.state);ensureRankedState(room.state);ensureSocialState(room.state);if((room.state.schemaVersion||1)>=2)prepareRecruitmentState(room.state,v2Catalog,clock.now());if(room.state.progressionV3)prepareV3RecruitmentState(room.state,v3Catalog,clock.now());ensureMissionState(room.state,clock.now(),{login:true});ensureAdminGiftState(room.state);ensureMailboxState(room.state,{now:clock.now()});room.state=reconcileV3BattlePresentation(room.state,v3Catalog).state;await persist(name,room.state);
          if(room.state.adminV1?.suspended){send(ws,{type:'error',error:'ACCOUNT_SUSPENDED'});ws.close(4003,'account suspended');return;}
          room.clients.set(ws,message.playerId);const identitySession=session||{provider:'local',name:message.playerId};ranked.register(name,identitySession);social.register(name,identitySession);trainingPvp.register(name,identitySession); broadcast(room); return;
        }
        const player = room.clients.get(ws);
        if (!player) return fail('join first');
        if (message.type !== 'action') return fail('unknown message type');
        if (player !== room.state.owner) return fail('spectators cannot act');
        if (Buffer.byteLength(JSON.stringify(message.action ?? null)) > 64 * 1024) return fail('action too large');
        if(message.action?.type?.startsWith('rankedV1.')){if(trainingPvp.busy(name))return fail('TRAINING_ROOM_ACTIVE');const result=await ranked.action(name,session||{provider:'local',name:player},message.action);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));return;}
        if(ranked.busy(name)&&(message.action?.type?.startsWith('battleV3.')||['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV3RecruitmentAction(message.action)||isV3ShopAction(message.action)||message.action?.type==='bagV1.rankProtection'))return fail('RANKED_MATCH_ACTIVE');
        if(message.action?.type?.startsWith('socialV1.')){const result=await social.action(name,session||{provider:'local',name:player},message.action);if(!result.ok)return fail(result.code);return;}
        if(message.action?.type?.startsWith('trainingPvpV1.')){if(ranked.busy(name))return fail('RANKED_MATCH_ACTIVE');const result=await trainingPvp.action(name,session||{provider:'local',name:player},message.action);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));return;}
        if(trainingPvp.busy(name)&&(message.action?.type?.startsWith('battleV3.')||['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV3RecruitmentAction(message.action)||isV3ShopAction(message.action)||message.action?.type==='bagV1.rankProtection'))return fail('TRAINING_ROOM_ACTIVE');
        if(message.action?.type==='legacy.finish'){
          if((room.state.schemaVersion||1)>=2||!room.state.battle?.result)return fail('NO_LEGACY_RESULT');
          await storage.backup(name,migrationBackups,'pre-v2-schema');const upgraded=upgradeAdventure(room.state,v2Catalog);await persist(name,upgraded.state);room.state=upgraded.state;broadcast(room);return;
        }
        if(isMailboxAction(message.action)){
          const result=applyMailboxAction(room.state,message.action,{now:clock.now()});if(!result.ok)return fail(result.code);
          if(result.changed)await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(isAdminGiftAction(message.action)){
          const result=applyAdminGiftAction(room.state,message.action,v3Catalog,{now:clock.now()});if(!result.ok)return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(isMissionAction(message.action)){
          const result=applyMissionAction(room.state,message.action,{serverNow:clock.now()});if(!result.ok)return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(message.action?.type==='bagV1.rankProtection'){
          const result=applyBagAction(room.state,message.action);if(!result.ok)return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(isV3ShopAction(message.action)){
          const result=applyV3ShopAction(room.state,message.action,v3Catalog);if(!result.ok)return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(room.state.battle&&!room.state.battle.result&&(['build.save','team.save','blueprint.import','buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)||isV2RecruitmentAction(message.action)||isV3RecruitmentAction(message.action)||message.action?.type?.startsWith('battleV2.')||message.action?.type?.startsWith('battleV3.')))return fail('LEGACY_BATTLE_ACTIVE');
        if(['buildV3.save','teamV3.save','teamV3.activate','replicaV3.apply'].includes(message.action?.type)){
          if(!room.state.progressionV3)return fail('SCHEMA_V3_NOT_READY');const result=applyV3ProgressionAction(room.state.progressionV3,message.action,v3Catalog);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          const next=structuredClone(room.state);next.progressionV3=result.progression;next.revision=(room.state.revision||0)+1;
          if(message.action.type==='buildV3.save'){const current=room.state.progressionV3.builds.find(build=>build.buildId===message.action.build?.buildId);const payment=checkoutV3Training(next,current,result.build,message.action);if(!payment.ok)return fail(payment.code);}
          room.state=next;if(['teamV3.save','replicaV3.apply'].includes(message.action.type)){room.state=reconcileV3BattleAfterTeamSave(room.state,result.team.teamId);recordMissionEvent(room.state,'teamSaves',1,clock.now());if(message.action.type==='replicaV3.apply')room.state.notice='Replica Team applied successfully.';}if(message.action.type==='teamV3.activate'&&room.state.battleV3?.phase==='PREVIEW')room.state.battleV3=null;await persist(name,room.state);broadcast(room);return;
        }
        if(isV3RecruitmentAction(message.action)){
          if(!room.state.progressionV3)return fail('SCHEMA_V3_NOT_READY');const result=applyV3RecruitmentAction(room.state,message.action,v3Catalog,{serverNow:clock.now()});if(!result.ok)return fail(result.code);
          if(!result.duplicate&&['recruitV3.trial','recruitV3.permanent'].includes(message.action.type))recordMissionEvent(result.state,'recruits',1,clock.now());
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(message.action?.type?.startsWith('battleV3.')){
          prepareV3RecruitmentState(room.state,v3Catalog,clock.now());
          const wasFinished=room.state.battleV3?.phase==='FINISHED',megaBefore=room.state.battleV3?.battle?.megaUsed?.A||0,result=applyV3BattleAction(room.state,message.action,v3Catalog);if(!result.ok)return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          const megaAfter=result.state.battleV3?.battle?.megaUsed?.A||0;if(megaAfter>megaBefore)recordMissionEvent(result.state,'megaEvolutions',megaAfter-megaBefore,clock.now());
          if(!wasFinished&&result.state.battleV3?.phase==='FINISHED'&&!result.state.battleV3.training){recordMissionEvent(result.state,'battles',1,clock.now());if(result.state.battleV3.battle?.result?.winner==='A')recordMissionEvent(result.state,'wins',1,clock.now());}
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (['build.save','team.save','blueprint.import'].includes(message.action?.type)) {
          const result=applyV2ProgressionAction(room.state,message.action,v2Catalog);
          if (!result.ok) return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (room.state.schemaVersion>=2&&isV2RecruitmentAction(message.action)) {
          const result=applyV2RecruitmentAction(room.state,message.action,v2Catalog,{serverNow:clock.now()});
          if (!result.ok) return fail(result.code);
          if(!result.duplicate&&['recruit.trial','recruit.permanent'].includes(message.action.type))recordMissionEvent(result.state,'recruits',1,clock.now());
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (room.state.schemaVersion>=2&&isV2EconomyAction(message.action)) {
          const result=applyV2EconomyAction(room.state,message.action,v2Catalog,{now:clock.now()});
          if (!result.ok) return fail(result.code);
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(room.state.schemaVersion>=2&&message.action?.type==='summon')return fail('LEGACY_SUMMON_DISABLED');
        if (typeof message.action?.type === 'string' && message.action.type.startsWith('battleV2.')) {
          const wasFinished=room.state.battleV2?.phase==='FINISHED',result=applyV2BattleAction(room.state,message.action,v2Catalog,{serverNow:clock.now()});
          if (!result.ok) return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
          if(!wasFinished&&result.state.battleV2?.phase==='FINISHED'){recordMissionEvent(result.state,'battles',1,clock.now());if(result.state.battleV2.result?.winner==='A'||result.state.battleV2.battle?.result?.winner==='A')recordMissionEvent(result.state,'wins',1,clock.now());}
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(room.state.schemaVersion>=2&&message.action?.type==='battle')return fail('LEGACY_BATTLE_DISABLED');
        const valid = validateAction(room.state,player,message.action);
        if (!valid.ok) return fail(valid.error);
        let next = applyAction(room.state,player,message.action);
        if((next.schemaVersion||1)>=2)synchronizeLegacyState(next,v2Catalog);
        await persist(name,next);room.state = next;
        broadcast(room);
      }).catch(error => { console.error('Local save/action error:', error.message); send(ws,{type:'error',error:'Could not save this action. Check the local server terminal.'}); });
    });
    ws.on('close', () => { room.queue = room.queue.then(() => {room.clients.delete(ws);if(room.clients.size===0){ranked.unregister(name);social.unregister(name);trainingPvp.unregister(name);} if(room.state) broadcast(room);}); });
  });
  return {
    server,
    listen: (port = 3100) => new Promise((resolve,reject) => {server.once('error',reject); server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port);});}),
    close: async () => {clearInterval(lifecycleTimer);clearInterval(websocketHeartbeatTimer);for(const ws of wss.clients) ws.terminate(); await Promise.all([...rooms.values()].map(r=>r.queue)); await new Promise(resolve=>wss.close(resolve)); await new Promise(resolve=>server.close(resolve));}
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createLocalServer({betaTestFunds:process.env.BETA_TEST_FUNDS==='true',authRequired:true});
  const port = await app.listen(Number(process.env.PORT || 3100));
  console.log(`Pokémon Vanguard: http://localhost:${port}\nAccount saves: Supabase when configured; local storage is development-only.\nEdit public files and refresh the browser. Rule changes restart in watch mode.`);
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await app.close();process.exit(0);});
}
