// B35 architectural regression gate: existing import checker owns cross-layer/cycle detection.
// This gate owns entrypoint delegation and the split contract for previously oversized hubs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(app,file),'utf8');
let assertions=0;
const requireText=(file,pattern,label)=>{if(!pattern.test(read(file)))throw new Error(`${file}: missing ${label}`);assertions++;};
const excludeText=(file,pattern,label)=>{if(pattern.test(read(file)))throw new Error(`${file}: ${label} belongs in a domain module`);assertions++;};
const maxBytes=(file,limit)=>{const bytes=Buffer.byteLength(read(file));if(bytes>limit)throw new Error(`${file}: entrypoint grew to ${bytes} bytes (max ${limit}); extract responsibility instead of condensing lines`);assertions++;};
const imports={
 'local-server.mjs':['server/http-request-handler.mjs','server/websocket-controller.mjs'],
 'server/websocket-controller.mjs':['player-action-dispatch.mjs','public-state-projector.mjs'],
 'server/ranked-v1.mjs':['ranked-profile.mjs','ranked-matchmaking.mjs','ranked-settlement-service.mjs','ranked-match-transitions.mjs','ranked-view-projection.mjs'],
 'mechanics-v3/manifest-contract.mjs':['manifest-values.mjs','manifest-handler-validation.mjs','manifest-move-validation.mjs'],
 'public/client.js':['js/client-feature-action-router.js','js/client-chrome-views.js','js/client-shell-layout.js','js/client-modal-templates.js'],
 'public/admin.js':['js/admin-views.js']
};
for(const [file,dependencies] of Object.entries(imports))for(const dependency of dependencies){
 requireText(file,new RegExp(`(?:from\\s*|import\\s*\\()\\s*['"]\\.?\\.?/?[^'"]*${dependency.split('/').at(-1).replaceAll('.','\\.')}['"]`),`import ${dependency}`);
}
requireText('local-server.mjs',/createHttpRequestHandler\(/,'HTTP composition');
requireText('local-server.mjs',/createWebsocketController\(/,'WS composition');
requireText('server/websocket-controller.mjs',/createPlayerActionDispatcher\(/,'isolated action dispatch');
requireText('server/websocket-controller.mjs',/quotas\.upgrade\(remoteIp\)/,'pre-upgrade IP quota');
requireText('server/websocket-controller.mjs',/inbound\.acquire\(/,'per-message inbound limiter');
requireText('server/player-action-dispatch.mjs',/withAccount/,'account lock for player writes');
requireText('server/ranked-v1.mjs',/tryRankedMatch\.call\(this,ticket\)/,'matchmaking service delegation');
requireText('server/ranked-v1.mjs',/rankedViewFor\.call\(this,accountId,state\)/,'read-only ranked view delegation');
requireText('server/ranked-v1.mjs',/applyRankedDecisionTimeout\.call\(this,match,now\)/,'ranked match timer delegation');
requireText('server/ranked-v1.mjs',/commitRankedSettlement\.call\(this,match\)/,'settlement service delegation');
requireText('mechanics-v3/manifest-contract.mjs',/validateManifestHandlers\(manifest,kind\)/,'handler validation composition');
requireText('mechanics-v3/manifest-contract.mjs',/validateMoveManifest\(manifest\)/,'move validation composition');
requireText('public/client.js',/renderClientShell\(/,'isolated render shell markup');
requireText('public/client.js',/renderConfirmDialog\(/,'isolated modal markup');
requireText('public/client.js',/renderRoutePage\(/,'route selector delegation');
requireText('public/client.js',/await routeFeatureClick\(el,/,'feature action delegation');
requireText('public/admin.js',/createAdminViews\(/,'presentational admin controller split');
excludeText('local-server.mjs',/server\.on\(['"]upgrade['"]/, 'WS upgrade handler');
excludeText('local-server.mjs',/message\.type\s*===?\s*['"]join['"]/, 'WS join handler');
excludeText('public/client.js',/class="battle-shell-layout"/,'shell markup');
excludeText('public/admin.js',/function (?:metrics|header|playersList|detailBody|giftsView)\(/,'admin HTML templates');
maxBytes('local-server.mjs',17_000);
maxBytes('server/ranked-v1.mjs',17_000);
maxBytes('mechanics-v3/manifest-contract.mjs',3_000);
maxBytes('public/admin.js',15_000);
maxBytes('public/client.js',59_000);
maxBytes('public/js/client-shell-layout.js',5_000);
maxBytes('public/js/client-modal-templates.js',5_000);
console.log(`B35 module boundary gate OK — ${assertions} assertions; use check:imports for layer/cycle contract`);
