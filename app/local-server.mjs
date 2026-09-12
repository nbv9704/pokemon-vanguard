import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { meta, setup, validateAction, applyAction, viewFor } from './src/logic.js';
import { JsonAdventureStorage } from './server/storage-json.mjs';
import { publicV2Catalog, v2Catalog } from './server/v2-catalog.mjs';
import {publicV3Catalog} from './server/v3-catalog.mjs';
import { applyV2ProgressionAction, v2TrainingView } from './server/v2-progression.mjs';
import { applyV2BattleAction, v2BattleView } from './server/v2-battle-actions.mjs';
import { applyV2EconomyAction, isV2EconomyAction } from './server/v2-economy.mjs';
import { inspectV2Damage } from './server/v2-damage-inspector.mjs';
import {synchronizeLegacyState,upgradeAdventure} from './server/v2-release.mjs';
import {createServerClock} from './server/clock.mjs';
import {applyV2RecruitmentAction,isV2RecruitmentAction,v2RecruitmentView} from './server/v2-recruitment.mjs';
import {prepareRecruitmentState} from './server/v2-recruitment-state.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2' };
async function readJsonBody(req,maxBytes=32*1024){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('Request too large'),{statusCode:413});chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export function createLocalServer({ saveDir = path.join(root, '.local-data'), clock = createServerClock() } = {}) {
  const rooms = new Map();
  const storage = new JsonAdventureStorage(saveDir);
  const migrationBackups=path.join(path.resolve(saveDir),'.migration-backups');
  const publicDir = path.join(root, 'public');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
  server.on('upgrade', (req, socket, head) => {
    let match, validOrigin = false;
    try {
      match = /^\/ws\/([A-Za-z0-9_-]{1,64})$/.exec(new URL(req.url, 'http://localhost').pathname);
      validOrigin = !req.headers.origin || new URL(req.headers.origin).host === req.headers.host;
    } catch {}
    if (!match || !validOrigin) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, match[1]));
  });
  const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  const broadcast = room => {
    const serverNow=clock.now();
    for (const [ws, player] of room.clients) {
      const legacyView=viewFor(room.state,player);
      const {rngState,rewardReceipts,economyLedger,actionReceipts,recruitmentV2:_privateRecruitmentV2,clockV2,mons,builds,teams,blueprints,nextMonId,nextBuildId,nextTeamId,nextBlueprintId,...publicAdventure}=legacyView;
      const recruitmentV2=v2RecruitmentView(room.state,v2Catalog,{serverNow}),viewNow=recruitmentV2?.effectiveNow??serverNow;
      const view=legacyView.spectator?{spectator:true}:{...publicAdventure,recruitmentTickets:room.state.wallet?.recruitmentTickets||0,trainingV2:v2TrainingView(room.state,v2Catalog,{now:viewNow}),recruitmentV2,battleV2:v2BattleView(room.state,v2Catalog)};
      send(ws, { type:'state', status:'playing', seats:[room.state.owner], you:player, connected:room.clients.size, view, result:null, meta });
    }
  };
  async function persist(name, state) {
    await storage.save(name,state);
  }
  wss.on('connection', (ws, name) => {
    if (!rooms.has(name)) rooms.set(name, { state:null, clients:new Map(), queue:Promise.resolve() });
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
          if (room.clients.has(ws)) return fail('already joined');
          if (!room.state) {
            const loaded=await storage.load(name);
            if(!loaded){const created=upgradeAdventure(setup([message.playerId]),v2Catalog);room.state=created.state;await persist(name,room.state);}
            else if(!loaded.battle){const upgraded=upgradeAdventure(loaded,v2Catalog);if(upgraded.status==='migrated'){await storage.backup(name,migrationBackups,'pre-v2-schema');room.state=upgraded.state;await persist(name,room.state);}else room.state=upgraded.state;}
            else room.state=loaded;
          }
          if((room.state.schemaVersion||1)>=2){prepareRecruitmentState(room.state,v2Catalog,clock.now());await persist(name,room.state);}
          room.clients.set(ws,message.playerId); broadcast(room); return;
        }
        const player = room.clients.get(ws);
        if (!player) return fail('join first');
        if (message.type !== 'action') return fail('unknown message type');
        if (player !== room.state.owner) return fail('spectators cannot act');
        if (Buffer.byteLength(JSON.stringify(message.action ?? null)) > 64 * 1024) return fail('action too large');
        if(message.action?.type==='legacy.finish'){
          if((room.state.schemaVersion||1)>=2||!room.state.battle?.result)return fail('NO_LEGACY_RESULT');
          await storage.backup(name,migrationBackups,'pre-v2-schema');const upgraded=upgradeAdventure(room.state,v2Catalog);await persist(name,upgraded.state);room.state=upgraded.state;broadcast(room);return;
        }
        if(room.state.battle&&!room.state.battle.result&&(['build.save','team.save','blueprint.import'].includes(message.action?.type)||isV2RecruitmentAction(message.action)||message.action?.type?.startsWith('battleV2.')))return fail('LEGACY_BATTLE_ACTIVE');
        if (['build.save','team.save','blueprint.import'].includes(message.action?.type)) {
          const result=applyV2ProgressionAction(room.state,message.action,v2Catalog);
          if (!result.ok) return fail(result.code);
          await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (room.state.schemaVersion>=2&&isV2RecruitmentAction(message.action)) {
          const result=applyV2RecruitmentAction(room.state,message.action,v2Catalog,{serverNow:clock.now()});
          if (!result.ok) return fail(result.code);
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if (room.state.schemaVersion>=2&&isV2EconomyAction(message.action)) {
          const result=applyV2EconomyAction(room.state,message.action,v2Catalog);
          if (!result.ok) return fail(result.code);
          synchronizeLegacyState(result.state,v2Catalog);await persist(name,result.state);room.state=result.state;broadcast(room);return;
        }
        if(room.state.schemaVersion>=2&&message.action?.type==='summon')return fail('LEGACY_SUMMON_DISABLED');
        if (typeof message.action?.type === 'string' && message.action.type.startsWith('battleV2.')) {
          const result=applyV2BattleAction(room.state,message.action,v2Catalog,{serverNow:clock.now()});
          if (!result.ok) return fail(result.code+(result.details?.length?`: ${result.details.join(', ')}`:''));
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
    ws.on('close', () => { room.queue = room.queue.then(() => {room.clients.delete(ws); if(room.state) broadcast(room);}); });
  });
  return {
    server,
    listen: (port = 3100) => new Promise((resolve,reject) => {server.once('error',reject); server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port);});}),
    close: async () => {for(const ws of wss.clients) ws.terminate(); await Promise.all([...rooms.values()].map(r=>r.queue)); await new Promise(resolve=>wss.close(resolve)); await new Promise(resolve=>server.close(resolve));}
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createLocalServer();
  const port = await app.listen(Number(process.env.PORT || 3100));
  console.log(`Pokémon Vanguard: http://localhost:${port}\nSaves: ${path.join(root,'.local-data')}\nEdit public files and refresh the browser. Rule changes restart in watch mode.`);
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await app.close();process.exit(0);});
}
