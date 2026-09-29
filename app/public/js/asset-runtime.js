const LOCAL_CONFIG=Object.freeze({schemaVersion:1,delivery:'local'});
const normalizePath=value=>{const path=String(value||'');return path.startsWith('/')&&!path.startsWith('//')?path:null;};
export function assetUrl(value){return value;}
export function localAssetPath(value){return normalizePath(value);}
export function assetRuntimeSnapshot(){return Object.freeze({config:LOCAL_CONFIG});}
export async function initializeAssetRuntime({onProgress=()=>{}}={}){onProgress({stage:'ready',loaded:1,total:1});return assetRuntimeSnapshot();}
export async function preloadAssets(paths,{ImageImpl=typeof Image!=='undefined'?Image:null,onProgress=()=>{},timeoutMs=7000,concurrency=4,connection=typeof navigator!=='undefined'?navigator.connection:null}={}){
 const list=[...new Set((paths||[]).map(normalizePath).filter(Boolean))];let loaded=0;
 if(!ImageImpl){onProgress({stage:'assets',loaded:list.length,total:list.length});return {loaded:list.length,failed:[]};}
 const failed=[],limit=Math.max(1,Math.min(list.length,connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||'')?2:concurrency));let cursor=0;
 const load=path=>new Promise(resolve=>{
  let settled=false,timer;const image=new ImageImpl();
  const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;loaded++;if(!ok)failed.push(path);onProgress({stage:'assets',loaded,total:list.length});resolve();};
  timer=setTimeout(()=>finish(false),timeoutMs);
  image.onload=()=>{const decoded=image.decode?.();if(decoded?.then)decoded.then(()=>finish(true),()=>finish(true));else finish(true);};
  image.onerror=()=>finish(false);image.src=path;
 });
 await Promise.all(Array.from({length:limit},async()=>{while(cursor<list.length)await load(list[cursor++]);}));
 return {loaded,failed};
}
