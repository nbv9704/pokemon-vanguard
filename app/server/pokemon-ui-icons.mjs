import {MOVE_CATEGORY_SYMBOLS,POKEMON_TYPE_SYMBOLS,SYMBOL_DIMENSIONS} from '../public/js/ui/pokemon-symbol-assets-data.js';
const typeUrls=Object.freeze({
 bug:['https://archives.bulbagarden.net/media/upload/2/26/Bug_icon_LA.png','https://archives.bulbagarden.net/media/upload/2/27/BugIC_LA.png'],dark:['https://archives.bulbagarden.net/media/upload/7/7f/Dark_icon_LA.png','https://archives.bulbagarden.net/media/upload/5/59/DarkIC_LA.png'],dragon:['https://archives.bulbagarden.net/media/upload/2/28/Dragon_icon_LA.png','https://archives.bulbagarden.net/media/upload/2/23/DragonIC_LA.png'],electric:['https://archives.bulbagarden.net/media/upload/7/75/Electric_icon_LA.png','https://archives.bulbagarden.net/media/upload/b/b4/ElectricIC_LA.png'],fairy:['https://archives.bulbagarden.net/media/upload/b/b1/Fairy_icon_LA.png','https://archives.bulbagarden.net/media/upload/a/ae/FairyIC_LA.png'],fighting:['https://archives.bulbagarden.net/media/upload/6/68/Fighting_icon_LA.png','https://archives.bulbagarden.net/media/upload/1/10/FightingIC_LA.png'],fire:['https://archives.bulbagarden.net/media/upload/4/48/Fire_icon_LA.png','https://archives.bulbagarden.net/media/upload/6/6c/FireIC_LA.png'],flying:['https://archives.bulbagarden.net/media/upload/d/de/Flying_icon_LA.png','https://archives.bulbagarden.net/media/upload/3/35/FlyingIC_LA.png'],ghost:['https://archives.bulbagarden.net/media/upload/b/b5/Ghost_icon_LA.png','https://archives.bulbagarden.net/media/upload/f/f3/GhostIC_LA.png'],grass:['https://archives.bulbagarden.net/media/upload/1/1b/Grass_icon_LA.png','https://archives.bulbagarden.net/media/upload/8/85/GrassIC_LA.png'],ground:['https://archives.bulbagarden.net/media/upload/4/45/Ground_icon_LA.png','https://archives.bulbagarden.net/media/upload/3/39/GroundIC_LA.png'],ice:['https://archives.bulbagarden.net/media/upload/7/70/Ice_icon_LA.png','https://archives.bulbagarden.net/media/upload/8/87/IceIC_LA.png'],normal:['https://archives.bulbagarden.net/media/upload/c/cb/Normal_icon_LA.png','https://archives.bulbagarden.net/media/upload/f/f6/NormalIC_LA.png'],poison:['https://archives.bulbagarden.net/media/upload/b/b4/Poison_icon_LA.png','https://archives.bulbagarden.net/media/upload/3/3a/PoisonIC_LA.png'],psychic:['https://archives.bulbagarden.net/media/upload/4/45/Psychic_icon_LA.png','https://archives.bulbagarden.net/media/upload/3/3c/PsychicIC_LA.png'],rock:['https://archives.bulbagarden.net/media/upload/8/85/Rock_icon_LA.png','https://archives.bulbagarden.net/media/upload/e/eb/RockIC_LA.png'],steel:['https://archives.bulbagarden.net/media/upload/f/f9/Steel_icon_LA.png','https://archives.bulbagarden.net/media/upload/9/99/SteelIC_LA.png'],water:['https://archives.bulbagarden.net/media/upload/5/5e/Water_icon_LA.png','https://archives.bulbagarden.net/media/upload/e/e3/WaterIC_LA.png']
});
const categoryUrls=Object.freeze({physical:'https://archives.bulbagarden.net/media/upload/6/61/PhysicalIC_LA.png',special:'https://archives.bulbagarden.net/media/upload/2/21/SpecialIC_LA.png',status:'https://archives.bulbagarden.net/media/upload/d/d3/StatusIC_LA.png'});
export const pokemonUiIconSources=Object.freeze({types:typeUrls,categories:categoryUrls});
export function pokemonUiIconEntries(){
 const out=[];
 for(const [id,entry] of Object.entries(POKEMON_TYPE_SYMBOLS)){const urls=typeUrls[id];out.push({kind:'type-icon',id,file:entry.icon,url:urls[0],size:SYMBOL_DIMENSIONS.typeIcon,path:`public/assets/ui/pokemon-types/icon/${entry.icon}`},{kind:'type-ic',id,file:entry.ic,url:urls[1],size:SYMBOL_DIMENSIONS.typeIc,path:`public/assets/ui/pokemon-types/ic/${entry.ic}`});}
 for(const [id,entry] of Object.entries(MOVE_CATEGORY_SYMBOLS))out.push({kind:'move-category',id,file:entry.file,url:categoryUrls[id],size:SYMBOL_DIMENSIONS.moveCategory,path:`public/assets/ui/move-categories/${entry.file}`});
 return out;
}
export function pokemonUiIconSourceFromPath(pathname){
 const match=String(pathname||'').match(/^\/api\/ui-symbols\/(type-icon|type-ic|move-category)\/([a-z-]+)$/);if(!match)return null;
 const [,kind,id]=match;
 if(kind==='move-category'){const file=MOVE_CATEGORY_SYMBOLS[id]?.file,url=categoryUrls[id];return file&&url?{kind,id,file,url}:null;}
 const entry=POKEMON_TYPE_SYMBOLS[id],urls=typeUrls[id];if(!entry||!urls)return null;
 return kind==='type-ic'?{kind,id,file:entry.ic,url:urls[1]}:{kind,id,file:entry.icon,url:urls[0]};
}
// The URL set above is finite. Never accept an arbitrary image URL from the request.
const PNG_MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const PROXY_MAX_BYTES=256*1024;
class IconFetchTimeout extends Error{constructor(){super('ICON_PROXY_TIMEOUT');this.code='ICON_PROXY_TIMEOUT';}}

async function readBoundedPng(response,maxBytes){
 if(!response.ok)throw new Error('ICON_UPSTREAM_HTTP');
 const contentType=response.headers?.get?.('content-type')||'';
 if(!/^image\/(?:png|x-png)(?:\s*;|\s*$)/i.test(contentType))throw new Error('ICON_INVALID_MEDIA_TYPE');
 const announced=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(announced)&&announced>maxBytes)throw new Error('ICON_TOO_LARGE');
 const reader=response.body?.getReader?.();
 if(!reader)throw new Error('ICON_MISSING_BODY');
 const chunks=[];let length=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
   if(length>maxBytes)throw new Error('ICON_TOO_LARGE');chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 const bytes=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)),length);
 if(bytes.length<PNG_MAGIC.length||!bytes.subarray(0,PNG_MAGIC.length).equals(PNG_MAGIC))throw new Error('ICON_INVALID_SIGNATURE');
 return bytes;
}

export function createPokemonUiIconProxy({fetchImpl=fetch,timeoutMs=5_000,maxBytes=PROXY_MAX_BYTES}={}){
 const cache=new Map(),inflight=new Map();
 timeoutMs=Number.isSafeInteger(timeoutMs)?Math.max(1,Math.min(timeoutMs,30_000)):5_000;
 maxBytes=Number.isSafeInteger(maxBytes)?Math.max(8,Math.min(maxBytes,1024*1024)):PROXY_MAX_BYTES;
 async function fetchIcon(source){
  const controller=new AbortController();let timer;
  // Promise.race also bounds injected/mock transports that do not honor AbortSignal.
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new IconFetchTimeout());},timeoutMs)});
  try{return await Promise.race([(async()=>{
   const response=await fetchImpl(source.url,{signal:controller.signal,headers:{'user-agent':'PokemonVanguard-asset-proxy/1.0'}});
   return readBoundedPng(response,maxBytes);
  })(),deadline]);}
  finally{clearTimeout(timer);}
 }
 return async function serve(req,res,url){
  const source=pokemonUiIconSourceFromPath(url.pathname);if(!source)return false;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return true;}
  try{
   let bytes=cache.get(source.url);
   if(!bytes){
    if(!inflight.has(source.url)){
     const pending=fetchIcon(source).then(data=>{cache.set(source.url,data);return data;});
     inflight.set(source.url,pending);pending.finally(()=>{if(inflight.get(source.url)===pending)inflight.delete(source.url);}).catch(()=>{});
    }
    bytes=await inflight.get(source.url);
   }
   res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){res.writeHead(error.code==='ICON_PROXY_TIMEOUT'?504:502,{'Cache-Control':'no-store'});res.end();}
  return true;
 };
}
