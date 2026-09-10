const PLAYER_KEY='aether-player';
const SETTINGS_KEY='aether-settings';

function readObject(storage,key){
 try{const value=JSON.parse(storage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}

export function createBrowserStore({storage,cryptoApi,locationLike}){
 let playerId=storage.getItem(PLAYER_KEY);
 if(!playerId){playerId=cryptoApi.randomUUID();storage.setItem(PLAYER_KEY,playerId);}
 const settings=readObject(storage,SETTINGS_KEY);
 const requestedRoom=new URLSearchParams(locationLike.search||'').get('room');
 return {
  playerId,
  room:requestedRoom||'aether-'+playerId,
  settings,
  saveSettings(){storage.setItem(SETTINGS_KEY,JSON.stringify(settings));}
 };
}

