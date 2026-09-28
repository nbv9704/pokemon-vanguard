import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {pokemonUiIconEntries} from '../server/pokemon-ui-icons.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),verify=process.argv.includes('--verify'),policy=process.argv.includes('--policy'),assets=pokemonUiIconEntries();
function pngSize(buffer){if(buffer.length<24||buffer.toString('ascii',1,4)!=='PNG')throw new Error('not a PNG');return[buffer.readUInt32BE(16),buffer.readUInt32BE(20)];}
async function validate(asset){const data=await readFile(resolve(root,asset.path)),actual=pngSize(data);if(actual[0]!==asset.size[0]||actual[1]!==asset.size[1])throw new Error(`${asset.path}: expected ${asset.size.join('x')}, got ${actual.join('x')}`);}
async function fetchAsset(asset){const full=resolve(root,asset.path);await mkdir(dirname(full),{recursive:true});const response=await fetch(asset.url,{headers:{'user-agent':'PokemonVanguard-asset-fetcher/1.0'}});if(!response.ok)throw new Error(`${asset.url}: HTTP ${response.status}`);await writeFile(full,Buffer.from(await response.arrayBuffer()));await validate(asset);console.log(`fetched ${asset.path}`);}
if(policy){
 // Explicitly distinguish fully vendored assets from the already-known 0/39
 // fallback-only source state. A partially mirrored/corrupt release is rejected.
 const unique=new Set();let present=0;
 for(const asset of assets){
  if(!/^https:\/\/archives\.bulbagarden\.net\//.test(asset.url)||!asset.path.startsWith('public/assets/ui/')||unique.has(asset.path))throw new Error(`Bad icon source contract: ${asset.path}`);
  unique.add(asset.path);
  try{await validate(asset);present++;}catch(error){if(error.code==='ENOENT')continue;throw error;}
 }
 if(assets.length!==39||present!==0&&present!==assets.length)throw new Error(`Partial/invalid local icon mirror: ${present}/${assets.length}`);
 console.log(`UI icon distribution policy OK: ${present}/${assets.length} local assets; ${present===0?'explicit fallback-only, NOT offline mirrored':'fully mirrored'}; redistribution rights review remains separate.`);
}else if(verify){let missing=0;for(const asset of assets){try{await validate(asset);}catch(error){missing++;console.error(String(error.message||error));}}if(missing)throw new Error(`Pokémon UI icon assets incomplete: ${assets.length-missing}/${assets.length}. Run npm run assets:ui-icons.`);console.log(`Pokémon UI icon assets OK — ${assets.length}/${assets.length}`);}else{for(const asset of assets)await fetchAsset(asset);console.log(`Pokémon UI icon assets fetched — ${assets.length}/${assets.length}`);}
