import {preloadAssets} from './asset-runtime.js';
import {PRESENTATION_ASSET_PATHS} from './presentation-assets.js';

const warmed=new Set();
export function collectBattleAssetPaths(state,{maxNodes=5000}={}){
 const ids=new Set(),seen=new Set();let visited=0;
 const visit=(value,depth=0)=>{
  if(!value||typeof value!=='object'||depth>12||seen.has(value)||visited++>=maxNodes)return;seen.add(value);
  if(!Array.isArray(value)){for(const key of ['spriteKey','speciesId'])if(typeof value[key]==='string'&&PRESENTATION_ASSET_PATHS[value[key]])ids.add(value[key]);}
  for(const child of Array.isArray(value)?value:Object.values(value))visit(child,depth+1);
 };
 const roots=[state?.battleV3,state?.battleV2,state?.battle,state?.rankedV1?.battleV3,state?.trainingPvpV1?.battleV3].filter(Boolean);for(const root of roots)visit(root);
 return [...ids].flatMap(id=>['front','back'].map(kind=>PRESENTATION_ASSET_PATHS[id][kind])).filter(Boolean);
}
export function warmBattleAssets(state,{preload=preloadAssets}={}){
 const paths=collectBattleAssetPaths(state).filter(path=>!warmed.has(path));for(const path of paths)warmed.add(path);if(paths.length)void Promise.resolve(preload(paths)).catch(()=>{for(const path of paths)warmed.delete(path);});return paths;
}
export function resetBattleAssetReadiness(){warmed.clear();}
