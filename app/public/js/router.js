import {assetUrl} from './asset-runtime.js';
export const NAV_ITEMS=[['home','/assets/icons/Home.png','Home'],['battle','/assets/icons/arena.png','Arena'],['collection','/assets/icons/pokedex.png','Pokedex'],['teams','/assets/icons/box.png','Box'],['recruitment','/assets/icons/recruitment.png','Recruitment'],['shop','/assets/icons/shop.png','Shop'],['missions','/assets/icons/missions.png','Missions'],['friends','/assets/icons/friends.png','Friends'],['gym','/assets/icons/gym.png','Gym Challenge'],['training','/assets/icons/training.png','Training'],['mail','/assets/icons/mailbox.png','Mailbox']].map(([id,path,label])=>[id,assetUrl(path),label]);

const routes=new Set([...NAV_ITEMS.map(([route])=>route),'bag','profile','settings']);
export function createRouter(initial='home',{onChange}={}){
 let current=routes.has(initial)?initial:'home';
 return {
  get current(){return current;},
  go(route){if(!routes.has(route))return false;if(route!==current){current=route;onChange?.(route);}return true;},
  has(route){return routes.has(route);}
 };
}
