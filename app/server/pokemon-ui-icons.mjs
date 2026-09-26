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
export function createPokemonUiIconProxy({fetchImpl=fetch}={}){
 const cache=new Map();
 return async function serve(req,res,url){
  const source=pokemonUiIconSourceFromPath(url.pathname);if(!source)return false;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return true;}
  try{
   let bytes=cache.get(source.url);if(!bytes){const response=await fetchImpl(source.url,{headers:{'user-agent':'PokemonVanguard-asset-proxy/1.0'}});if(!response.ok)throw new Error(`HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());cache.set(source.url,bytes);}
   res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(502,{'Cache-Control':'no-store'});res.end();}
  return true;
 };
}
