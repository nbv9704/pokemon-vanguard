/** Opt-in audit of a manually opened, disposable account's REAL game route. */
import {writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {IMAGE_VARIANTS} from '../public/js/image-variants.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPO=path.dirname(ROOT);
const LABELS=new Set(['bag','shop','training','arena','profile','battle','modal']);
const ARM=`(()=>{if(window.__pvImageRouteQa)return true;const q=window.__pvImageRouteQa={shifts:[],armedAt:performance.now()};try{q.observer=new PerformanceObserver(list=>{for(const event of list.getEntries())if(!event.hadRecentInput)q.shifts.push(event.value)});q.observer.observe({type:'layout-shift',buffered:false});}catch{q.unavailable=true;}return true;})()`;
const SNAPSHOT=`(()=>({
 viewport:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio,
 readyState:document.readyState,
 fallbackTextRows:[...document.querySelectorAll('.pv-symbol-text-fallback')].map(item=>({named:item.getAttribute('role')==='img'&&!!item.getAttribute('aria-label'),decorative:item.getAttribute('aria-hidden')==='true'})),
 imageRows:[...document.images].filter(img=>img.getBoundingClientRect().width>0&&img.getBoundingClientRect().height>0).map(img=>({
  src:(()=>{try{const u=new URL(img.getAttribute('src')||'',location.href);return u.origin===location.origin?u.pathname:'external'}catch{return 'invalid'}})(),
  selected:(()=>{try{const u=new URL(img.currentSrc,location.href);return u.origin===location.origin?u.pathname:'external'}catch{return 'invalid'}})(),
  width:img.naturalWidth,height:img.naturalHeight,
  cssWidth:Math.round(img.getBoundingClientRect().width),cssHeight:Math.round(img.getBoundingClientRect().height),
  complete:img.complete,hasSrcset:!!img.getAttribute('srcset')
 })),
 clsSinceArm:window.__pvImageRouteQa?.shifts.reduce((a,b)=>a+b,0)??null,
 clsArmed:!!window.__pvImageRouteQa&&!window.__pvImageRouteQa.unavailable,
 paintFcp:performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime??null,
 imageTiming:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='img').map(e=>({
  bytes:e.transferSize,encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize,durationMs:Math.round(e.duration)
 }))
}))()`;

export function analyzeRouteImageSnapshot(raw,{label}={}){
 if(!LABELS.has(label))throw Error('Unknown route label');
 if(!raw||!Array.isArray(raw.imageRows)||!Number.isFinite(raw.dpr)||raw.dpr<=0)throw Error('Invalid browser snapshot');
 const missing=[],insufficient=[],wrongVariant=[];let responsive=0,remoteFallback=0;
 const fallbackTextRows=raw.fallbackTextRows||[];
 const unlabelledFallback=fallbackTextRows.flatMap((row,index)=>row.named||row.decorative?[]:[index]);
 for(const [index,img] of raw.imageRows.entries()){
  if(img.complete&&(!img.width||!img.height))missing.push(index);
  if(img.selected?.startsWith('/api/ui-symbols/'))remoteFallback++;
  const variant=IMAGE_VARIANTS[img.src];
  if(!variant||!img.hasSrcset)continue;
  responsive++;
  const chosen=raw.dpr>1?variant.two:variant.one;
  if(img.selected!==chosen)wrongVariant.push(index);
  if(img.width+1<img.cssWidth*raw.dpr)insufficient.push(index);
 }
 const timing=raw.imageTiming||[];
 return {label,viewport:raw.viewport,viewportHeight:raw.viewportHeight,dpr:raw.dpr,readyState:raw.readyState,
  visibleImages:raw.imageRows.length,responsive,remoteFallback,offlineSymbolBadges:fallbackTextRows.length,unlabelledFallback,
  missing,insufficient,wrongVariant,passed:missing.length===0&&insufficient.length===0&&wrongVariant.length===0&&unlabelledFallback.length===0,
  clsSinceArm:raw.clsArmed?raw.clsSinceArm:null,
  initialDocumentFcpMs:raw.paintFcp,
  network:{imageResources:timing.length,transferBytes:timing.reduce((sum,row)=>sum+row.bytes,0),decodedBodyBytes:timing.reduce((sum,row)=>sum+row.decodedBytes,0)},
  notes:['No player IDs, image alt text, cookies, or full URLs are exported.',
   'CLS is observed only since --arm in this tab; null means no observer. Browser FCP describes the initial document, NOT SPA route FCP.',
   'Resource timing may include earlier tabs/routes and cached resources; use clean disposable sessions for comparisons.',
   'Passed checks apply to visible DOM images/manifest mappings only: manual visual and accessibility QA remain required.']};
}

async function connectChrome(port,tabHint){
 const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error(`CDP discovery HTTP ${response.status}`);
 const tabs=(await response.json()).filter(item=>item.type==='page'&&item.webSocketDebuggerUrl&&/^https?:\/\//.test(item.url));
 const matching=tabHint?tabs.filter(t=>t.url.startsWith(tabHint)):tabs;
 if(matching.length!==1)throw Error(`Expected exactly one matching Chrome game tab; found ${matching.length}. Supply --tab http://127.0.0.1:PORT/ (without account data).`);
 const ws=new WebSocket(matching[0].webSocketDebuggerUrl,{handshakeTimeout:4000}),pending=new Map();let serial=0;
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.on('message',buffer=>{let message;try{message=JSON.parse(String(buffer));}catch{return;}
  const task=pending.get(message.id);if(!task)return;pending.delete(message.id);clearTimeout(task.timer);
  if(message.error)task.reject(Error(message.error.message));else task.resolve(message.result);
 });
 function send(method,params={}){return new Promise((resolve,reject)=>{
  const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP ${method} timeout`));},8000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });}
 function close(){ws.close();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('CDP disconnected'));}pending.clear();}
 return {send,close};
}

export function assertSafeReportDirectory(directory,{repo=REPO}={}){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('--output must be an absolute directory outside the repository');
 const relative=path.relative(repo,directory);
 if(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw Error('Reports must stay outside the repository to protect account data');
}

export async function runRouteAudit({port,tabHint,label,output,arm=false,screenshotSynthetic=false}={}){
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Provide a local debugging port: --cdp 9222');
 if(!arm&&!LABELS.has(label))throw Error('Select --label bag|shop|training|arena|profile|battle|modal');
 if(!arm)assertSafeReportDirectory(output);
 const cdp=await connectChrome(port,tabHint);
 try{
  await cdp.send('Runtime.enable');
  if(arm){const result=await cdp.send('Runtime.evaluate',{expression:ARM,returnByValue:true});if(result.exceptionDetails)throw Error('Could not arm layout-shift observer');return {armed:true};}
  const result=await cdp.send('Runtime.evaluate',{expression:SNAPSHOT,returnByValue:true});
  if(result.exceptionDetails||!result.result?.value)throw Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  const report=analyzeRouteImageSnapshot(result.result.value,{label});
  await mkdir(output,{recursive:true});
  assertSafeReportDirectory(await realpath(output)); // Reject symlinked output directories into the repository.
  const file=`${label}-${report.viewport}px-dpr${report.dpr}`;
  if(screenshotSynthetic){
   await cdp.send('Page.enable');
   const screenshot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   await writeFile(path.join(output,`${file}.png`),Buffer.from(screenshot.data,'base64'));
  }
  await writeFile(path.join(output,`${file}.json`),JSON.stringify({...report,syntheticScreenshot:screenshotSynthetic?`${file}.png`:null},null,2)+'\n');
  if(!report.passed)throw Error(`Visible image audit failed for ${label}: missing=${report.missing.length}, DPR=${report.insufficient.length}, variants=${report.wrongVariant.length}, unlabeled=${report.unlabelledFallback.length}. Report was saved.`);
  return report;
 }finally{cdp.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const get=name=>{const index=process.argv.indexOf(name);return index<0?null:process.argv[index+1];};
 const port=Number(get('--cdp')||0);
 const arm=process.argv.includes('--arm');
 const synthetic=process.argv.includes('--synthetic-screenshot');
 if(synthetic&&!process.argv.includes('--confirm-disposable-account'))throw Error('Screenshots may expose player data: use a disposable test account and explicitly supply --confirm-disposable-account');
 const result=await runRouteAudit({port,tabHint:get('--tab'),label:get('--label'),output:get('--output'),arm,screenshotSynthetic:synthetic});
 console.log(JSON.stringify(result,null,2));
}
