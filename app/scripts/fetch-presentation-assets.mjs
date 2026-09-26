import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async relative=>JSON.parse(await fs.readFile(path.join(root,relative),'utf8'));
const slice=await read('content-src/beta-slice-v35.json');
const mega=await read('content-src/mega-beta-v8.json');
const ids=[...slice.team.map(entry=>entry.speciesId),...mega.relations.filter(entry=>entry.regulationSets?.includes('m-a')).map(entry=>entry.megaSpeciesId)];
const force=process.argv.includes('--force');
const API='https://pokeapi.co/api/v2/pokemon/';
const SHOWDOWN='https://play.pokemonshowdown.com/sprites/';
const aliases={
  meowstic:'meowstic-male',
  gourgeist:'gourgeist-average',
  'tauros-paldea':'tauros-paldea-combat-breed',
  basculegion:'basculegion-male',
  aegislash:'aegislash-shield',
  'gourgeist-jumbo':'gourgeist-super',
  maushold:'maushold-family-of-four',
  mimikyu:'mimikyu-disguised',
  morpeko:'morpeko-full-belly',
  palafin:'palafin-zero',
  'meowstic-mega':'meowstic-male-mega',
};
const showdownAliases={
  'lycanroc-midday':'lycanroc',
  'kommo-o':'kommoo',
  'mr-rime':'mrrime',
  'tauros-paldea':'tauros-paldeacombat',
  'tauros-paldea-aqua-breed':'tauros-paldeaaqua',
  'tauros-paldea-blaze-breed':'tauros-paldeablaze',
  'meowstic-female':'meowstic-f',
  'basculegion-female':'basculegion-f',
  'charizard-mega-x':'charizard-megax',
  'charizard-mega-y':'charizard-megay',
  'meowstic-mega':'meowstic-mmega',
};

if(ids.length!==272||new Set(ids).size!==272)throw new Error(`Expected 272 unique M-A ids, got ${ids.length}/${new Set(ids).size}`);

const extension=url=>{
  const ext=path.extname(new URL(url).pathname).toLowerCase();
  if(!['.gif','.png'].includes(ext))throw new Error(`Unsupported presentation asset extension: ${url}`);
  return ext;
};
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const validImage=(buffer,ext)=>ext==='.gif'?buffer.subarray(0,4).toString('ascii')==='GIF8':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};

async function fetchJson(url){
  const response=await fetch(url,{headers:{'User-Agent':'AetherChampions-local-asset-import/1.0'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function showdownDirectory(directory){
  const response=await fetch(`${SHOWDOWN}${directory}/`,{headers:{'User-Agent':'AetherChampions-local-asset-import/1.0'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${SHOWDOWN}${directory}/`);
  const html=await response.text();
  return new Set([...html.matchAll(/href="(?:\.\/)?([^"/]+\.gif)"/gi)].map(match=>decodeURIComponent(match[1]).replace(/\.gif$/i,'')));
}

const [showdownFront,showdownBack]=await Promise.all([showdownDirectory('ani'),showdownDirectory('ani-back')]);
const normalizeShowdownName=value=>value.replace(/[^a-z0-9]/g,'');
const normalizedDirectory=names=>{
  const output=new Map();
  for(const name of names){
    const key=normalizeShowdownName(name);
    if(!output.has(key))output.set(key,name);
  }
  return output;
};
const normalizedFront=normalizedDirectory(showdownFront),normalizedBack=normalizedDirectory(showdownBack);
const showdownUrl=(entry,directory,names,normalized)=>{
  const preferred=showdownAliases[entry.id];
  const name=[preferred,entry.id,entry.apiName].find(candidate=>candidate&&names.has(candidate))
    ||normalized.get(normalizeShowdownName(entry.id))
    ||normalized.get(normalizeShowdownName(entry.apiName));
  return name?`${SHOWDOWN}${directory}/${name}.gif`:null;
};

async function download(url,relative){
  const target=path.join(root,'public',relative),ext=path.extname(target).toLowerCase();
  const alternative=target.slice(0,-ext.length)+(ext==='.gif'?'.png':'.gif');
  if(!force&&await exists(target)){
    const body=await fs.readFile(target);
    if(!validImage(body,ext))throw new Error(`Existing asset has invalid ${ext} signature: ${relative}`);
    await fs.rm(alternative,{force:true});
    return {relative:`/${relative.replaceAll('\\','/')}`,bytes:body.length,sha256:sha256(body),downloaded:false};
  }
  const response=await fetch(url,{headers:{'User-Agent':'AetherChampions-local-asset-import/1.0'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const body=Buffer.from(await response.arrayBuffer());
  if(!validImage(body,ext))throw new Error(`Downloaded asset has invalid ${ext} signature: ${url}`);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const temporary=`${target}.download`;
  await fs.writeFile(temporary,body);
  await fs.rename(temporary,target);
  await fs.rm(alternative,{force:true});
  return {relative:`/${relative.replaceAll('\\','/')}`,bytes:body.length,sha256:sha256(body),downloaded:true};
}

async function mapLimit(values,limit,worker){
  const output=new Array(values.length);let next=0;
  async function run(){while(next<values.length){const index=next++;output[index]=await worker(values[index],index);}}
  await Promise.all(Array.from({length:Math.min(limit,values.length)},run));
  return output;
}

const pokemon=await mapLimit(ids,12,async id=>{
  const apiName=aliases[id]||id,data=await fetchJson(`${API}${apiName}`),official=data.sprites?.other?.['official-artwork']||{},home=data.sprites?.other?.home||{};
  const entry={id,apiName};
  const urls={
    front:showdownUrl(entry,'ani',showdownFront,normalizedFront)||data.sprites?.front_default,
    back:showdownUrl(entry,'ani-back',showdownBack,normalizedBack)||data.sprites?.back_default,
    artwork:official.front_default||home.front_default||data.sprites?.front_default,
  };
  for(const [kind,url] of Object.entries(urls))if(!url)throw new Error(`PokéAPI has no ${kind} asset for ${id} (${apiName})`);
  return {id,apiName,pokeApiId:data.id,urls};
});

let completed=0,downloaded=0;
const sources=await mapLimit(pokemon,10,async entry=>{
  const frontExt=extension(entry.urls.front),backExt=extension(entry.urls.back),artExt=extension(entry.urls.artwork);
  const targets={front:`pokemon-sprites/${entry.id}${frontExt}`,back:`pokemon-sprites/back/${entry.id}${backExt}`,artwork:`pokemon-artwork/${entry.id}${artExt}`};
  const [front,back,artwork]=await Promise.all([
    download(entry.urls.front,targets.front),download(entry.urls.back,targets.back),download(entry.urls.artwork,targets.artwork),
  ]);
  downloaded+=[front,back,artwork].filter(asset=>asset.downloaded).length;
  completed++;
  if(completed%25===0||completed===ids.length)console.log(`presentation assets ${completed}/${ids.length}`);
  return {id:entry.id,apiName:entry.apiName,pokeApiId:entry.pokeApiId,front:{url:entry.urls.front,...front},back:{url:entry.urls.back,...back},artwork:{url:entry.urls.artwork,...artwork}};
});

const provenance={
  schemaVersion:1,
  id:'ma-presentation-asset-sources-v1',
  generatedAt:new Date().toISOString(),
  source:{animatedSprites:'https://play.pokemonshowdown.com/sprites/',staticImages:'https://pokeapi.co/api/v2/',pokeApiRepository:'https://github.com/PokeAPI/sprites',pokeApiLicense:'https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt'},
  note:'GIF battle sprites are fetched directly from Pokémon Showdown. PokéAPI supplies official artwork and static PNG fallbacks where Showdown has no matching GIF. Pokémon image content and trademarks remain the property of their respective rights holders.',
  entries:sources,
};
await fs.writeFile(path.join(root,'content-src/presentation-asset-sources-v1.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(`presentation asset fetch complete — ${ids.length*3} files resolved; ${downloaded} downloaded, ${ids.length*3-downloaded} already present`);
