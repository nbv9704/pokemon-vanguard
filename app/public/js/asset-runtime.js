const DEFAULT_CONFIG=Object.freeze({schemaVersion:1,baseUrl:'',manifestPath:'/asset-manifest.json'});
const LOCAL_TEST_ORIGIN='http:'+'//localhost';
let config={...DEFAULT_CONFIG},manifest=null,boundDocument=null;
const normalizePath=value=>{const path=String(value||'');return path.startsWith('/')&&!path.startsWith('//')?path:null;};
const normalizedBase=value=>String(value||'').trim().replace(/\/+$/,'');
function acceptedBase(value,origin){
 const base=normalizedBase(value);if(!base)return '';
 try{const url=new URL(base,origin);if(url.username||url.password)return '';if(url.origin===origin||url.protocol==='https:'||(['localhost','127.0.0.1','::1'].includes(url.hostname)&&url.protocol==='http:'))return url.href.replace(/\/+$/,'');}catch{}
 return '';
}
export function configureAssetRuntime(next={},origin=typeof location!=='undefined'?location.origin:LOCAL_TEST_ORIGIN){
 config={schemaVersion:1,baseUrl:acceptedBase(next.baseUrl,origin),manifestPath:normalizePath(next.manifestPath)||DEFAULT_CONFIG.manifestPath};manifest=null;return assetRuntimeSnapshot();
}
export function assetUrl(value){const path=normalizePath(value);if(!path||!config.baseUrl)return value;return `${config.baseUrl}${path}`;}
export function localAssetPath(value){
 if(!config.baseUrl)return null;
 try{const target=new URL(value,typeof location!=='undefined'?location.href:LOCAL_TEST_ORIGIN),base=new URL(config.baseUrl+'/');if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))return null;const relative=target.pathname.slice(base.pathname.length);return '/'+relative+target.search; }catch{return null;}
}
export function assetRuntimeSnapshot(){return Object.freeze({config:{...config},manifest});}
export function setAssetManifest(next){if(next?.schemaVersion!==1||!Array.isArray(next.entries)||typeof next.release!=='string')throw new Error('Invalid asset manifest');manifest=next;return manifest;}
async function fetchJson(fetchImpl,url,{timeoutMs=5000}={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetchImpl(url,{headers:{Accept:'application/json'},credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}finally{clearTimeout(timer);}}
export async function initializeAssetRuntime({fetchImpl=fetch,origin=location.origin,onProgress=()=>{},loadManifest=false}={}){
 const total=loadManifest?2:1;onProgress({stage:'config',loaded:0,total});
 let next=DEFAULT_CONFIG;try{next=await fetchJson(fetchImpl,'/api/assets/config');}catch{}
 configureAssetRuntime(next,origin);onProgress({stage:loadManifest?'manifest':'ready',loaded:1,total});
 if(loadManifest)try{setAssetManifest(await fetchJson(fetchImpl,assetUrl(config.manifestPath)));}catch{if(config.baseUrl){configureAssetRuntime(DEFAULT_CONFIG,origin);try{setAssetManifest(await fetchJson(fetchImpl,config.manifestPath));}catch{}}}
 onProgress({stage:'ready',loaded:total,total});return assetRuntimeSnapshot();
}
export async function preloadAssets(paths,{ImageImpl=typeof Image!=='undefined'?Image:null,onProgress=()=>{},timeoutMs=7000,origin=typeof location!=='undefined'?location.href:LOCAL_TEST_ORIGIN,disableRemoteOnFailure=true}={}){
 const list=[...new Set((paths||[]).map(normalizePath).filter(Boolean))];let loaded=0;
 if(!ImageImpl){onProgress({stage:'assets',loaded:list.length,total:list.length});return {loaded:list.length,failed:[]};}
 const failed=[];
 await Promise.all(list.map(path=>new Promise(resolve=>{
  let settled=false,timer;const image=new ImageImpl();
  const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;loaded++;if(!ok)failed.push(path);onProgress({stage:'assets',loaded,total:list.length});resolve();};
  timer=setTimeout(()=>finish(false),timeoutMs);
  image.onload=()=>{const decoded=image.decode?.();if(decoded?.then)decoded.then(()=>finish(true),()=>finish(true));else finish(true);};
  image.onerror=()=>{const local=new URL(path,origin).href;if(image.src!==local){if(disableRemoteOnFailure&&config.baseUrl)config={...config,baseUrl:''};image.src=path;return;}finish(false);};
  image.src=assetUrl(path);
 })));
 return {loaded,failed};
}
export function bindAssetFallback(documentRef=typeof document!=='undefined'?document:null){
 if(!documentRef||boundDocument===documentRef)return;boundDocument=documentRef;
 documentRef.addEventListener('error',event=>{const image=event.target;if(!image||String(image.tagName).toUpperCase()!=='IMG')return;const local=localAssetPath(image.currentSrc||image.src);if(local&&image.getAttribute('src')!==local){image.removeAttribute('srcset');image.src=local;}},true);
}
