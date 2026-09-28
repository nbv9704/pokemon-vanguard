const PLAYER_KEY='aether-player';
const SETTINGS_KEY='aether-settings';

function readObject(storage,key){
 const raw=storage.getItem(key);
 try{const value=JSON.parse(raw||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}

// Accessing the storage property itself may throw (sandboxed/private contexts),
// before getItem/setItem can be handled by createBrowserStore.
export function availableBrowserStorage(browser){
 try{return browser.localStorage??null;}catch{return null;}
}

export function createBrowserStore({storage,cryptoApi,locationLike}){
 let persistent=true,playerId;try{playerId=storage.getItem(PLAYER_KEY);}catch{persistent=false;playerId=null;}
 if(!playerId){playerId=cryptoApi.randomUUID();try{storage.setItem(PLAYER_KEY,playerId);}catch{persistent=false;}}
 let settings;try{settings=readObject(storage,SETTINGS_KEY);}catch{persistent=false;settings={};}
 const requestedRoom=new URLSearchParams(locationLike.search||'').get('room');
 return {
  playerId,
  room:requestedRoom||'aether-'+playerId,
  settings,
  get persistent(){return persistent;},
  saveSettings(){try{storage.setItem(SETTINGS_KEY,JSON.stringify(settings));return true;}catch{persistent=false;return false;}}
 };
}
