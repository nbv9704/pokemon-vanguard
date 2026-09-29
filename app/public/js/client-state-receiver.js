import {warmBattleAssets} from './battle-asset-readiness.js';

export function createClientStateReceiver({root,receive,warm=warmBattleAssets}){
 return (view,envelope)=>{
  if(view.spectator){root.innerHTML='<div class="empty">This adventure belongs to another player. <a href="/">Open your own adventure</a></div>';return;}
  warm(view);receive(view,envelope);
 };
}
