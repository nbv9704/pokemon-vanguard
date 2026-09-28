/** Isolated real-browser image transfer / decode / DPR / CLS harness; no player data. */
import {createServer} from 'node:http';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStaticHttpResponse} from '../server/http-public-assets.mjs';
import WebSocket from 'ws';

const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GROUPS=['assets/icons','assets/items','ranks','pokemon-artwork'];
const SAMPLE_COUNTS=[4,4,3,5];
export function selectSamples(manifest){
 const rows=[];
 for(let g=0;g<GROUPS.length;g++){
  const group=manifest.items.filter(entry=>entry.category===GROUPS[g]);
  if(group.length<SAMPLE_COUNTS[g])throw new Error(`Insufficient images in ${GROUPS[g]}`);
  // Stable spread rather than always selecting early Pokédex alphabetic entries.
  for(let n=0;n<SAMPLE_COUNTS[g];n++)rows.push(group[Math.floor(n*(group.length-1)/Math.max(1,SAMPLE_COUNTS[g]-1))]);
 }
 return rows;
}
export function galleryHtml(samples,{optimized=true}={}){
 const cards=samples.map(record=>{
  const css=record.displayCssPx,src=optimized?(record.legacy?.url||record.id):`/__qa-master/${encodeURIComponent(record.id)}`;
  const srcset=optimized?` srcset="${xml(record.variants['1x'].url)} 1x, ${xml(record.variants['2x'].url)} 2x"`:'';
  return `<figure><div class="slot" style="width:${css}px;height:${css}px"><img width="${css}" height="${css}" alt="${xml(record.id)}" src="${xml(src)}"${srcset} decoding="async"></div><figcaption>${xml(record.id)}</figcaption></figure>`;
 }).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated PNG optimization QA</title><style>
 body{font:12px sans-serif;margin:16px;background:#1b222d;color:#f5f6fa}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}figure{margin:0;border:1px solid #596577;padding:8px;min-height:120px}.slot{display:flex;align-items:center;justify-content:center}img{display:block;max-width:100%;height:auto;object-fit:contain}figcaption{font-size:10px;overflow-wrap:anywhere;margin-top:8px}
 </style><script>
 window.__qa={shifts:[],ready:false};new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__qa.shifts.push(e.value)}).observe({type:'layout-shift',buffered:true});
 window.addEventListener('load',async()=>{await Promise.all([...document.images].map(async img=>{try{await img.decode()}catch{}}));requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__qa.ready=true}))});
 </script></head><body><h1>${optimized?'optimized srcset':'original master baseline'}</h1><main class="grid">${cards}</main></body></html>`;
}
export function evaluateSource(){return `(()=>({
 dpr:devicePixelRatio,viewport:innerWidth,cls:window.__qa.shifts.reduce((sum,x)=>sum+x,0),
 images:[...document.images].map(img=>({alt:img.alt,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight,cssWidth:Math.round(img.getBoundingClientRect().width),currentSrc:img.currentSrc,failed:!img.naturalWidth})),
 resourceBytes:performance.getEntriesByType('resource').filter(item=>item.initiatorType==='img').reduce((sum,item)=>sum+item.decodedBodySize,0),
 transferBytes:performance.getEntriesByType('resource').filter(item=>item.initiatorType==='img').reduce((sum,item)=>sum+item.transferSize,0),
 encodedBodyBytes:performance.getEntriesByType('resource').filter(item=>item.initiatorType==='img').reduce((sum,item)=>sum+item.encodedBodySize,0),
 resources:performance.getEntriesByType('resource').filter(item=>item.initiatorType==='img').map(item=>({url:item.name.split('/').slice(-1)[0],decodedBytes:item.decodedBodySize,encodedBytes:item.encodedBodySize,transferBytes:item.transferSize,durationMs:item.duration})),
 firstContentfulPaint:performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime??null
 }))()`;}

function chromeCandidates(){return process.platform==='win32'?[process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Google/Chrome/Application/chrome.exe')].filter(Boolean):['chromium','google-chrome','chromium-browser'];}
async function launchChrome(chrome,profile){
 const args=['--headless=new','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-extensions','--no-proxy-server','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'];
 if(process.platform!=='win32'&&process.getuid?.()===0)args.unshift('--no-sandbox');
 const proc=spawn(chrome,args,{stdio:'ignore'});
 let error=null;proc.on('error',err=>{error=err;});
 for(let i=0;i<40;i++){
  if(error||proc.exitCode!==null)break;
  try{
   const [port]=String(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');
   if(/^\d+$/.test(port))return {proc,port:Number(port)};
  }catch{}
  await pause(250);
 }
 proc.kill('SIGKILL');
 throw new Error(`Chromium did not start from ${chrome} within 10s${error?`: ${error.message}`:''}; rerun on a desktop with --chrome /path/to/chrome. No browser acceptance is recorded.`);
}
async function connect(port){
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const tab=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
 if(!tab)throw new Error('Chrome DevTools has no inspectable page');
 const ws=new WebSocket(tab.webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.on('message',raw=>{let msg;try{msg=JSON.parse(String(raw));}catch{return;}const task=pending.get(msg.id);if(!task)return;pending.delete(msg.id);clearTimeout(task.timer);msg.error?task.reject(Error(msg.error.message)):task.resolve(msg.result);});
 function send(method,params={}){return new Promise((resolve,reject)=>{
  const next=++id,timer=setTimeout(()=>{pending.delete(next);reject(Error(`CDP ${method} timed out`));},12000);
  pending.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method,params}));
 });}
 return {send,close:()=>{ws.close();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('CDP connection closed'));}pending.clear();}};
}
async function serveGallery(samples){
 const staticResponse=createStaticHttpResponse(path.join(APP,'public'));
 const originals=new Map(samples.map(entry=>[entry.id,path.join(APP,entry.source.file)]));
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname==='/qa'){
    const html=galleryHtml(samples,{optimized:url.searchParams.get('mode')!=='baseline'});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
   }
   if(url.pathname.startsWith('/__qa-master/')){
    const id=decodeURIComponent(url.pathname.slice('/__qa-master/'.length)),file=originals.get(id);
    if(!file){res.writeHead(404);res.end();return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);return;
   }
   await staticResponse(req,res,url.pathname);
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
export function assertGallerySelection(row,samples,{mode,dpr}){
 if(row.images.length!==samples.length)throw Error(`Expected ${samples.length} image elements, got ${row.images.length}`);
 for(let i=0;i<samples.length;i++){
  const entry=samples[i],img=row.images[i];
  if(img.alt!==entry.id||img.failed||!img.complete)throw Error(`Missing/unexpected image ${entry.id}`);
  if(mode==='optimized'){
   const expected=entry.variants[dpr===2?'2x':'1x'].url;
   if(new URL(img.currentSrc,'http://127.0.0.1').pathname!==expected)throw Error(`Wrong DPR${dpr} source for ${entry.id}`);
   if(img.naturalWidth<img.cssWidth*dpr-1)throw Error(`Insufficient DPR${dpr} density: ${entry.id}`);
  }else if(!new URL(img.currentSrc,'http://127.0.0.1').pathname.startsWith('/__qa-master/'))throw Error(`Wrong original master: ${entry.id}`);
 }
}
export function summarizeGalleryCaptures(rows){
 const pairs=[];
 for(const width of [360,1366])for(const dpr of [1,2]){
  const baseline=rows.find(row=>row.width===width&&row.dpr===dpr&&row.mode==='baseline');
  const optimized=rows.find(row=>row.width===width&&row.dpr===dpr&&row.mode==='optimized');
  if(!baseline||!optimized)throw Error(`Missing baseline/optimized capture for ${width}px DPR${dpr}`);
  pairs.push({width,dpr,originalTransfer:baseline.transferBytes,optimizedTransfer:optimized.transferBytes,
   originalDecoded:baseline.resourceBytes,optimizedDecoded:optimized.resourceBytes,
   transferSaved:baseline.transferBytes-optimized.transferBytes,originalCls:baseline.cls,optimizedCls:optimized.cls,
   originalFcp:baseline.firstContentfulPaint,optimizedFcp:optimized.firstContentfulPaint});
 }
 if(rows.length!==8)throw Error(`Expected eight synthetic gallery captures, received ${rows.length}`);
 return pairs;
}
async function capture(cdp,{base,mode,width,dpr,output,samples}){
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:820,deviceScaleFactor:dpr,mobile:width<=360});
 await cdp.send('Network.clearBrowserCache');const navigation=await cdp.send('Page.navigate',{url:`${base}/qa?mode=${mode}`});
 if(navigation.errorText)throw new Error(`Chromium navigation failed for synthetic gallery: ${navigation.errorText}`);
 let ready=false;
 for(let i=0;i<80;i++){
  await pause(150);
  const result=await cdp.send('Runtime.evaluate',{expression:'Boolean(window.__qa?.ready)',returnByValue:true});
  if(result.result.value){ready=true;break;}
 }
 if(!ready){
  const state=await cdp.send('Runtime.evaluate',{expression:'({url:location.href,title:document.title,readyState:document.readyState,qa:window.__qa?.ready??null,images:document.images.length,failedImages:[...document.images].filter(img=>img.complete&&!img.naturalWidth).map(img=>img.alt)})',returnByValue:true});
  throw new Error(`Gallery never completed image decoding: ${mode}, DPR${dpr}, ${width}px; browser state: ${JSON.stringify(state.result?.value||state.exceptionDetails)}`);
 }
 const result=await cdp.send('Runtime.evaluate',{expression:evaluateSource(),returnByValue:true});
 if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
 const row=result.result.value;
 assertGallerySelection(row,samples,{mode,dpr});
 const screenshot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 const imageName=`${mode}-${width}px-dpr${dpr}.png`;await writeFile(path.join(output,imageName),Buffer.from(screenshot.data,'base64'));
 return {mode,width,dpr,screenshot:imageName,...row};
}
export async function runImageQa({chrome,output}){
 const manifest=JSON.parse(await readFile(path.join(APP,'docs/image-assets-b25.json'),'utf8'));
 const samples=selectSamples(manifest),profile=await mkdtemp(path.join(tmpdir(),'pv-b26-chrome-'));
 let server=null,browser=null,cdp=null;
 try{
  await mkdir(output,{recursive:true});server=await serveGallery(samples);
  const binary=chrome||process.env.PV_CHROME||chromeCandidates()[0];
  browser=await launchChrome(binary,profile);cdp=await connect(browser.port);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.enable');
  const rows=[];
  for(const width of [360,1366])for(const dpr of [1,2])for(const mode of ['baseline','optimized']){
   const row=await capture(cdp,{base:server.base,width,dpr,mode,output,samples});rows.push(row);
   console.log(`${mode} ${width}px DPR${dpr}: ${row.resourceBytes} decoded resource B, CLS=${row.cls}, FCP=${row.firstContentfulPaint}`);
  }
  const report={schemaVersion:2,samples:samples.map(entry=>entry.id),rows,comparisons:summarizeGalleryCaptures(rows),notes:['Isolated synthetic gallery, not authenticated route/FCP of the full game.','Original-master baseline versus verified 1x/2x srcset; browser transferSize includes HTTP headers and may vary with cache.','Run game-route QA and rights review separately before closing #22.']};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  return report;
 }finally{cdp?.close();browser?.proc.kill('SIGKILL');if(server)await server.close();await rm(profile,{force:true,recursive:true,maxRetries:2,retryDelay:200});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const flag=name=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null;};
 const output=path.resolve(flag('--output')||path.join(tmpdir(),'pv-image-qa-b26'));
 await runImageQa({chrome:flag('--chrome'),output});console.log(`Image browser QA report: ${output}`);
}
