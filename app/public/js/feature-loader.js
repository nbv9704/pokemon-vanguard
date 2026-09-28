export class RouteModuleRegistry{
 constructor(loaders={}){this.loaders=new Map(Object.entries(loaders));this.entries=new Map();}
 status(name){const entry=this.entries.get(name);return entry?{state:entry.state,error:entry.error||null}:{state:'idle',error:null};}
 load(name,{retry=false}={}){
  const loader=this.loaders.get(name);if(!loader)return Promise.reject(new Error(`Unknown route module: ${name}`));
  const current=this.entries.get(name);if(current&&!retry)return current.promise;
  if(current?.state==='loading')return current.promise;
  const entry={state:'loading',error:null,promise:null};
  entry.promise=Promise.resolve().then(loader).then(value=>{entry.state='ready';entry.value=value;return value;},error=>{entry.state='error';entry.error=error;throw error;});
  this.entries.set(name,entry);return entry.promise;
 }
 preload(name){return this.load(name).catch(()=>undefined);}
}

export function createCatalogLoader(fetchImpl=fetch){
 const entries=new Map();
 const status=version=>{const entry=entries.get(version);return entry?{state:entry.state,error:entry.error||null}:{state:'idle',error:null};};
 const load=(version,url,{retry=false}={})=>{
  const current=entries.get(version);if(current&&!retry)return current.promise;
  if(current?.state==='loading')return current.promise;
  const entry={state:'loading',error:null,promise:null};
  entry.promise=Promise.resolve().then(()=>fetchImpl(url)).then(response=>{if(!response.ok)throw new Error(`Unable to load ${version.toUpperCase()} catalog`);return response.json();}).then(value=>{entry.state='ready';entry.value=value;return value;},error=>{entry.state='error';entry.error=error;throw error;});
  entries.set(version,entry);return entry.promise;
 };
 return {load,status};
}

export function createStyleLoader(documentLike=document){
 const entries=new Map();
 const load=href=>{
  const current=entries.get(href);if(current)return current;
  const promise=new Promise((resolve,reject)=>{const link=documentLike.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.featureStyle=href;link.addEventListener('load',()=>resolve(link),{once:true});link.addEventListener('error',()=>{entries.delete(href);link.remove();reject(new Error(`Unable to load stylesheet: ${href}`));},{once:true});documentLike.head.append(link);});
  entries.set(href,promise);return promise;
 };
 return {load,loadMany:hrefs=>Promise.all(hrefs.map(load))};
}
