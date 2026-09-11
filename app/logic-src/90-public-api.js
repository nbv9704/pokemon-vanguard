
export const meta={game:"Pokémon Vanguard",minPlayers:1,maxPlayers:1};
const TYPES=["Flame","Tide","Bloom","Volt","Frost","Stone","Gale","Shadow","Light","Venom","Steel","Astral"];
const COLORS=["#ff9361","#5bd9ef","#9ee59c","#f3d76c","#b3e8ff","#d2b49a","#94dccf","#ac9fee","#ffe2a1","#d398e6","#a7bfd5","#faadda"];
const NAMES=["Emberlyn","Cindrake","Volcaram","Tideray","Coralisk","Shellure","Mossprout","Thornox","Florawisp","Voltkit","Stormaw","Ampillo","Frostowl","Glacirn","Snowmelt","Pebblit","Obsidon","Dunewyrm","Zephyroo","Galesong","Cyclopup","Gloomoth","Noctalon","Umbrawolf","Solmane","Aurorix","Lumifin","Venomble","Toxipede","Mirecap","Ironcub","Gearaptor","Chromantis","Astralyn","Runelisk","Orbitail"];
const SECOND=[6,5,10,6,9,10,6,5,8,7,6,10,6,8,1,1,10,7,5,8,3,9,6,11,0,11,1,1,5,2,5,6,2,7,5,1];
const ABILITIES=[
{name:"Dawnbringer",desc:"On entry, sets Sun for 5 turns. Flame damage ×1.5; Tide ×0.5.",weather:"Sun"},
{name:"Raincaller",desc:"On entry, sets Rain for 5 turns. Tide damage ×1.5; Flame ×0.5.",weather:"Rain"},
{name:"Wild Growth",desc:"On entry, sets Meadow for 5 turns. Bloom damage ×1.3; all active monsters heal 6% each turn.",weather:"Meadow"},
{name:"Static Field",desc:"On entry, sets Storm for 5 turns. Volt damage ×1.5.",weather:"Storm"},
{name:"Snowglobe",desc:"On entry, sets Snow for 5 turns. Frost defense ×1.5.",weather:"Snow"},
{name:"Sandstream",desc:"On entry, sets Sand for 5 turns. Non-Stone/Steel monsters lose 5% HP each turn.",weather:"Sand"},
{name:"Tailwind",desc:"Speed increases by 30%."},
{name:"Night Hunter",desc:"Deals 25% more damage to opponents below half HP."},
{name:"Radiance",desc:"Restores 5% of maximum HP at the end of each turn."},
{name:"Venom Touch",desc:"Damaging moves poison targets for 3 turns; Venom and Steel are immune."},
{name:"Ironhide",desc:"Reduces incoming damage by 20%."},
{name:"Mind Link",desc:"Your active partner deals 15% more damage in doubles."}
];
const ITEMS=[
{name:"None",desc:"No held item."},{name:"Vital Seed",desc:"Restore 8% HP at the end of each turn."},
{name:"Power Lens",desc:"Deal 20% more damage."},{name:"Aegis Plate",desc:"Receive 20% less damage."},
{name:"Swift Feather",desc:"Increase speed by 25%."},{name:"Cure Berry",desc:"Cures the first burn or poison each battle."},
{name:"Focus Crystal",desc:"Once per battle, survive a lethal hit at 1 HP if starting at full HP."}
];
const STRONG={Flame:["Bloom","Frost","Steel"],Tide:["Flame","Stone"],Bloom:["Tide","Stone"],Volt:["Tide","Gale"],Frost:["Bloom","Gale"],Stone:["Flame","Volt"],Gale:["Bloom","Venom"],Shadow:["Astral","Light"],Light:["Shadow","Venom"],Venom:["Bloom","Light"],Steel:["Frost","Light"],Astral:["Venom","Steel"]};
const RESIST={Flame:["Flame","Tide","Stone"],Tide:["Tide","Bloom"],Bloom:["Flame","Bloom","Gale","Steel"],Volt:["Volt","Bloom"],Frost:["Flame","Frost","Steel"],Stone:["Bloom","Steel"],Gale:["Volt","Steel"],Shadow:["Shadow","Steel"],Light:["Light","Steel"],Venom:["Venom","Stone"],Steel:["Flame","Tide","Steel"],Astral:["Astral"]};
const IMMUNE={Volt:["Stone"],Venom:["Steel"],Astral:["Shadow"]};
const MOVENAMES=["Ember Fang","Tidal Pulse","Vine Lash","Arc Bolt","Ice Shard","Stone Hammer","Wind Cutter","Night Slash","Solar Beam","Toxic Sting","Iron Claw","Mind Burst"];
const WEATHER=["Sun","Rain","Meadow","Storm","Snow","Sand"];
function species(id){
 const t=Math.floor(id/3), r=id%3;
 return {id,name:NAMES[id],types:[TYPES[t],TYPES[SECOND[id]]],color:COLORS[t],rarity:id>=32?"Legendary":r===2?"Epic":r===1?"Rare":"Common",ability:ABILITIES[t],hp:108+(id*7%29),attack:47+(id*11%22),defense:42+(id*13%22),speed:40+(id*17%45),moves:[
 {name:MOVENAMES[t],type:TYPES[t],power:55,cost:0,effect:t===0?"burn":t===9?"poison":t===4?"slow":"damage",desc:"Reliable single-target strike."},
 {name:TYPES[SECOND[id]]+" Lance",type:TYPES[SECOND[id]],power:80,cost:2,effect:"damage",desc:"Heavy single-target strike."},
 {name:t<6?WEATHER[t]+" Call":r===0?"Mend":r===1?"Guard":"Rally",type:TYPES[t],power:0,cost:2,effect:t<6?"weather":r===0?"heal":r===1?"guard":"boost",weather:t<6?WEATHER[t]:null,desc:t<6?"Sets "+WEATHER[t]+" for 5 turns.":r===0?"Restores 35% maximum HP.":r===1?"Blocks damage this turn. Acts first.":"Raises your attack 25% for this battle."},
 {name:TYPES[t]+" Tempest",type:TYPES[t],power:45,cost:3,effect:"spread",desc:"Hits every active opponent."}]};
}
function effectiveness(type,types){return types.reduce((v,t)=>v*(IMMUNE[type]?.includes(t)?0:STRONG[type]?.includes(t)?2:RESIST[type]?.includes(t)?.5:1),1);}
function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function owned(id){return {id,level:5,item:0,xp:0};}
export function setup(players){
 let seed=982451653; for(const c of String(players[0]||"aether")) seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 return {owner:players[0],seed,version:1,coins:2400,gems:1800,pity:0,summons:0,wins:0,badges:[],collection:[0,3,6,9,12,15].map(owned),team:[0,3,6,9],mail:[],battle:null,reveal:[],notice:"Welcome, Challenger. Your first six companions are ready."};
}
function active(b,side){return b[side].map((m,i)=>({m,i})).filter(x=>x.m.hp>0&&x.m.slot>=0);}
function unit(id,level,item,slot){const d=species(id); const max=d.hp+level*6; return {id,level,item,slot,hp:max,max,energy:5,status:null,statusTurns:0,boost:1,guard:false,used:false};}
function stat(m,key){let v=species(m.id)[key]+m.level*2;if(key==="speed"){if(Math.floor(m.id/3)===6)v*=1.3;if(m.item===4)v*=1.25;if(m.status==="slow")v*=.6;}return v;}
function entry(b,m){let a=species(m.id).ability;if(a.weather){b.weather=a.weather;b.weatherTurns=5;b.log.push(species(m.id).name+"'s "+a.name+" summoned "+a.weather+".");}}
function int(v,min,max){return Number.isInteger(v)&&v>=min&&v<=max;}
export function validateAction(s,p,a){
 const fail=error=>({ok:false,error});if(p!==s.owner)return fail("This is another player's adventure.");if(!a||typeof a!=="object")return fail("Invalid action.");
 const busy=s.battle&&!s.battle.result;
 if(a.type==="battle"){
 if(busy)return fail("Finish or surrender the current battle.");if(!["single","double"].includes(a.mode))return fail("Choose a battle format.");
 if(a.gym!==undefined&&(!int(a.gym,0,5)||a.gym>s.badges.length))return fail("Clear the previous gym first.");
 if(s.team.length<(a.mode==="double"?2:1))return fail("Add more monsters to your team.");return {ok:true};}
 if(a.type==="turn"){
 const b=s.battle;if(!busy)return fail("No battle in progress.");if(a.round!==b.round)return fail("That turn has already resolved.");
 let actors=active(b,"allies");
 if(!Array.isArray(a.commands)||a.commands.length!==actors.length)return fail("Choose an action for every active monster.");
 let used=[],switches=[];
 for(const c of a.commands){
 if(!c||!actors.some(x=>x.i===c.actor)||used.includes(c.actor))return fail("Invalid active monster.");used.push(c.actor);
 if(c.kind==="switch"){
 if(!int(c.to,0,b.allies.length-1)||b.allies[c.to].hp<=0||b.allies[c.to].slot>=0||switches.includes(c.to))return fail("Choose a healthy reserve.");switches.push(c.to);
 }else{
 if(c.kind!=="move"||!int(c.move,0,3))return fail("Choose a move.");
 const m=b.allies[c.actor],move=species(m.id).moves[c.move];
 if(m.energy<move.cost)return fail("Not enough energy. Use your basic move to recover.");
 if(move.power&&!active(b,"enemies").some(x=>x.i===c.target))return fail("Choose a living opponent.");
 }}
 return {ok:true};}
 if(a.type==="surrender")return busy?{ok:true}:fail("No battle in progress.");
 if(busy)return fail("Finish the battle before changing your roster.");
 if(a.type==="summon")return [1,10].includes(a.count)&&s.gems>=a.count*100?{ok:true}:fail("Summoning costs 100 crystals per pull.");
 if(a.type==="train"){const m=s.collection.find(x=>x.id===a.id);return m&&m.level<30&&s.coins>=m.level*30?{ok:true}:fail("Training needs coins; maximum level is 30.");}
 if(a.type==="equip")return s.collection.some(x=>x.id===a.id)&&int(a.item,0,6)?{ok:true}:fail("Choose an owned monster and valid item.");
 if(a.type==="team")return Array.isArray(a.ids)&&a.ids.length>=1&&a.ids.length<=4&&new Set(a.ids).size===a.ids.length&&a.ids.every(id=>s.collection.some(m=>m.id===id))?{ok:true}:fail("Your team needs 1–4 different owned monsters.");
 if(a.type==="claim")return int(a.id,0,2)&&!s.mail.includes(a.id)&&(a.id!==1||s.wins>=1)&&(a.id!==2||s.badges.length>=1)?{ok:true}:fail("Reward already claimed or milestone not reached.");
 return fail("Unknown action.");
}
function damage(b,m,t,mv,side){
 let multiplier=effectiveness(mv.type,species(t.id).types);
 if(species(m.id).types.includes(mv.type))multiplier*=1.25;
 if(b.weather==="Sun")multiplier*=mv.type==="Flame"?1.5:mv.type==="Tide"?.5:1;
 if(b.weather==="Rain")multiplier*=mv.type==="Tide"?1.5:mv.type==="Flame"?.5:1;
 if(b.weather==="Storm"&&mv.type==="Volt")multiplier*=1.5;
 if(b.weather==="Meadow"&&mv.type==="Bloom")multiplier*=1.3;
 if(b.weather==="Snow"&&species(t.id).types.includes("Frost"))multiplier/=1.5;
 if(m.item===2)multiplier*=1.2;if(t.item===3)multiplier*=.8;
 if(Math.floor(t.id/3)===10)multiplier*=.8;
 if(Math.floor(m.id/3)===7&&t.hp<t.max/2)multiplier*=1.25;
 if(active(b,side).some(x=>x.m!==m&&Math.floor(x.m.id/3)===11))multiplier*=1.15;
 if(m.status==="burn")multiplier*=.75;
 return Math.floor((mv.power*.55*stat(m,"attack")/stat(t,"defense")+8)*multiplier*m.boost);
}
function heal(m,n){m.hp=Math.min(m.max,m.hp+Math.max(1,Math.floor(n)));}
// Presentation events are emitted by the rules, never inferred from the text log.
// Each frame owns its snapshot so later actions cannot change earlier HP/slots.
function recordEvent(b,event){
 b.events.push({...event,frame:JSON.parse(JSON.stringify({allies:b.allies,enemies:b.enemies,weather:b.weather,weatherTurns:b.weatherTurns,log:b.log}))});
}
function execute(b,side,c){
 const other=side==="allies"?"enemies":"allies",m=b[side][c.actor];if(!m||m.hp<=0||m.slot<0)return;
 const name=species(m.id).name;
 if(c.kind==="switch"){const to=b[side][c.to];if(to&&to.hp>0&&to.slot<0){to.slot=m.slot;m.slot=-1;b.log.push(name+" switched to "+species(to.id).name+".");entry(b,to);return {kind:"switch",side,actor:c.actor,incoming:c.to,name:species(to.id).name};}return;}
 const mv=species(m.id).moves[c.move];if(m.energy<mv.cost)return;m.energy-=mv.cost;
 const event={kind:"move",side,actor:c.actor,name,move:{...mv},targets:[]};
 const beforeHp=m.hp;
 b.log.push(name+" used "+mv.name+".");
 if(mv.effect==="weather"){b.weather=mv.weather;b.weatherTurns=5;}
 else if(mv.effect==="heal")heal(m,m.max*.35);
 else if(mv.effect==="guard")m.guard=true;
 else if(mv.effect==="boost")m.boost=Math.min(2,m.boost+.25);
 else{
 let targets=mv.effect==="spread"?active(b,other):[{m:b[other][c.target]?.slot>=0&&b[other][c.target]?.hp>0?b[other][c.target]:active(b,other)[0]?.m}];
 for(const {m:t} of targets){if(!t)continue;const tn=species(t.id).name;
 const target={side:other,index:b[other].indexOf(t),damage:0,effectiveness:effectiveness(mv.type,species(t.id).types),blocked:!!t.guard};
 event.targets.push(target);
 if(t.guard){b.log.push(tn+" blocked the attack.");continue;}
 let d=damage(b,m,t,mv,side);const ef=effectiveness(mv.type,species(t.id).types);
 if(t.item===6&&!t.used&&t.hp===t.max&&d>=t.hp){d=t.hp-1;t.used=true;b.log.push(tn+"'s Focus Crystal activated.");}
 target.damage=Math.min(t.hp,d);
 t.hp=Math.max(0,t.hp-d);b.log.push(tn+" −"+d+" HP"+(ef===0?" · Immune":ef>1?" · Super effective!":ef<1?" · Resisted":"")+".");
 if(d>0&&t.hp>0){const status=Math.floor(m.id/3)===9?"poison":["burn","poison","slow"].includes(mv.effect)?mv.effect:null;
 if(status&&!t.status&&!(status==="poison"&&species(t.id).types.some(t=>["Venom","Steel"].includes(t)))&&!(status==="burn"&&species(t.id).types.includes("Flame"))){
 t.status=status;t.statusTurns=3;
 if(t.item===5&&!t.used){t.status=null;t.statusTurns=0;t.used=true;b.log.push(tn+"'s Cure Berry activated.");}
 }}
 target.status=t.status;target.fainted=t.hp===0;
 if(t.hp===0)b.log.push(tn+" fainted.");
 }}
 event.healing=m.hp-beforeHp;
 return event;
}
function finish(s){
 const b=s.battle;let win=b.enemies.every(m=>m.hp<=0),lose=b.allies.every(m=>m.hp<=0);
 if(!win&&!lose&&b.round<=80)return;
 const result=win?"Victory":lose?"Defeat":"Draw";b.result=result;
 let coins=win?180:60,gems=win?80:20;
 if(win&&b.gym!==null&&!s.badges.includes(b.gym)){s.badges.push(b.gym);coins+=500;gems+=300;}
 s.coins+=coins;s.gems+=gems;if(win)s.wins++;
 b.reward={coins,gems};s.notice=result+" · +"+coins+" coins · +"+gems+" crystals";
}

export function applyAction(state,p,a){
 if(!validateAction(state,p,a).ok)return state;
 const s=JSON.parse(JSON.stringify(state));s.reveal=[];
 if(a.type==="battle"){
 s.battleSerial=(s.battleSerial||0)+1;
 const gym=a.gym??null,level=gym!==null?5+gym*3:Math.max(4,Math.round(s.team.reduce((v,id)=>v+s.collection.find(m=>m.id===id).level,0)/s.team.length));
 let ids=gym!==null?[gym*6,gym*6+1,gym*6+2,gym*6+3]:Array.from({length:4},()=>Math.floor(rand(s)*36));
 const n=a.mode==="double"?2:1;
 s.battle={id:s.battleSerial,events:[],mode:a.mode,gym,round:1,weather:"Clear",weatherTurns:0,allies:s.team.map((id,i)=>{const m=s.collection.find(x=>x.id===id);return unit(id,m.level,m.item,i<n?i:-1);}),enemies:ids.map((id,i)=>unit(id,level,gym!==null?1+gym%6:0,i<n?i:-1)),log:["Battle begins. Choose your moves."],result:null};
 for(const side of ["enemies","allies"])for(const x of active(s.battle,side))entry(s.battle,x.m);
 }else if(a.type==="turn"){
 const b=s.battle;b.events=[];b.eventsRound=b.round;b.log=["Turn "+b.round];for(const side of ["allies","enemies"])for(const m of b[side])m.guard=false;
 let queue=a.commands.map(c=>({side:"allies",c}));
 for(const {m,i} of active(b,"enemies")){
 let best={score:-1,move:0,target:active(b,"allies")[0].i};
 species(m.id).moves.forEach((mv,k)=>{if(mv.cost>m.energy)return;for(const t of active(b,"allies")){let score=mv.power?damage(b,m,t.m,mv,"enemies")*(mv.effect==="spread"?active(b,"allies").length:1):mv.effect==="heal"&&m.hp<m.max*.45?m.max*.4:0;if(score>best.score)best={score,move:k,target:t.i};}});
 queue.push({side:"enemies",c:{kind:"move",actor:i,move:best.move,target:best.target}});
 }
 const priority=q=>q.c.kind==="switch"?10000:species(b[q.side][q.c.actor].id).moves[q.c.move].effect==="guard"?9000:stat(b[q.side][q.c.actor],"speed");
 queue.sort((x,y)=>priority(y)-priority(x));
 for(const q of queue){const event=execute(b,q.side,q.c);if(event)recordEvent(b,event);}
 for(const side of ["allies","enemies"]){
 for(const {m,i} of active(b,side)){
 const hpBefore=m.hp,condition=m.status;
 if(m.status==="poison"||m.status==="burn"){let loss=Math.max(1,Math.floor(m.max*.07));m.hp=Math.max(0,m.hp-loss);b.log.push(species(m.id).name+" −"+loss+" HP ("+m.status+").");}
 if(m.hp>0&&b.weather==="Sand"&&!species(m.id).types.some(t=>["Stone","Steel"].includes(t)))m.hp=Math.max(0,m.hp-Math.floor(m.max*.05));
 if(m.hp>0){if(m.item===1)heal(m,m.max*.08);if(Math.floor(m.id/3)===8)heal(m,m.max*.05);if(b.weather==="Meadow")heal(m,m.max*.06);}
 if(m.status&&--m.statusTurns<=0)m.status=null;
 m.energy=Math.min(5,m.energy+1);
 if(m.hp!==hpBefore)recordEvent(b,{kind:"upkeep",side,actor:i,name:species(m.id).name,condition:condition||b.weather,change:m.hp-hpBefore});
 }
 for(const m of b[side])if(m.hp<=0&&m.slot>=0){const slot=m.slot;m.slot=-1;const next=b[side].find(v=>v.hp>0&&v.slot<0);if(next){next.slot=slot;b.log.push(species(next.id).name+" entered the battle.");entry(b,next);recordEvent(b,{kind:"entry",side,actor:b[side].indexOf(next),name:species(next.id).name});}}
 }
 if(b.weatherTurns>0&&--b.weatherTurns===0){b.weather="Clear";b.log.push("The field returned to clear weather.");}
 b.round++;finish(s);
 }else if(a.type==="surrender"){s.battle.result="Surrendered";s.battle.reward={coins:0,gems:0};s.notice="Battle ended. Your team has recovered.";}
 else if(a.type==="summon"){
 s.gems-=a.count*100;
 for(let k=0;k<a.count;k++){
 s.pity++;s.summons++;const roll=rand(s);
 const rarity=s.pity>=50||roll<.02?"Legendary":s.summons%10===0||roll<.10?"Epic":roll<.40?"Rare":"Common";
 const pool=Array.from({length:36},(_,i)=>species(i)).filter(m=>m.rarity===rarity);let id=pool[Math.floor(rand(s)*pool.length)].id;if(rarity==="Legendary")s.pity=0;
 const duplicate=s.collection.some(m=>m.id===id);if(duplicate)s.coins+=150;else s.collection.push(owned(id));s.reveal.push({id,duplicate});
 }s.notice="Summoning complete. Duplicates convert to 150 coins.";
 }else if(a.type==="train"){const m=s.collection.find(x=>x.id===a.id);s.coins-=m.level*30;m.level++;s.notice=species(m.id).name+" reached level "+m.level+".";}
 else if(a.type==="equip"){s.collection.find(x=>x.id===a.id).item=a.item;s.notice=ITEMS[a.item].name+" equipped.";}
 else if(a.type==="team"){s.team=a.ids;s.notice="Battle team updated.";}
 else if(a.type==="claim"){s.mail.push(a.id);s.coins+=[500,400,800][a.id];s.gems+=[500,300,500][a.id];s.notice="Mailbox rewards claimed.";}
 return s;
}
export function isGameOver(){return {over:false};}
export function viewFor(s,p){
 if(p!==s.owner)return {spectator:true};
 const {seed,owner,...v}=s;
 return {...v,catalog:Array.from({length:36},(_,i)=>species(i)),items:ITEMS,types:TYPES,colors:COLORS,typeChart:TYPES.map(t=>TYPES.map(d=>effectiveness(t,[d])))};
}
