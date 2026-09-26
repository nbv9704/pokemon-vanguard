export const NAV_ITEMS=[['home','◈','Command Center'],['battle','⚔','Battle Arena'],['collection','▦','Pokémon Archive'],['teams','⬡','Team Builder'],['recruitment','⌁','Recruitment'],['missions','★','Missions'],['gym','♜','Gym Challenge'],['training','⤴','Training Room'],['mail','✉','Mailbox']];

const routes=new Set([...NAV_ITEMS.map(([route])=>route),'settings']);
export function createRouter(initial='home'){
 let current=routes.has(initial)?initial:'home';
 return {
  get current(){return current;},
  go(route){if(!routes.has(route))return false;current=route;return true;},
  has(route){return routes.has(route);}
 };
}
