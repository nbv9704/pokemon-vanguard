
import {creature} from "./art.js";
import {BattleAnimator} from "./battle-animation.js";
import {createBrowserStore} from "./js/store.js";
import {createRouter,NAV_ITEMS} from "./js/router.js";
import {AdventureConnection,websocketUrl} from "./js/net.js";
import {TrainingEditor} from "./js/training-editor.js";
import {BoxView} from "./js/box-view.js";
import {TeamBuilder} from "./js/team-builder.js";
import {V2BattleScreen} from "./js/v2-battle-screen.js";
import {DamageInspector} from "./js/damage-inspector.js";
import {renderV2Tutorial} from "./js/v2-tutorial.js";
const browserStore=createBrowserStore({storage:localStorage,cryptoApi:crypto,locationLike:location});
const id=browserStore.playerId,room=browserStore.room,router=createRouter();
let V=null,commands={},pending=false,modalId=null,lastNotice="",connected=false,toastTimer;
let latestView=null,playback=null,playbackVersion=0;
const settings=browserStore.settings;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const art=id=>'<div class="art">'+creature(id)+'</div>';
const btn=(label,action,cls="",disabled=false)=>'<button class="'+cls+'" data-action="'+action+'" '+(disabled?"disabled":"")+'>'+label+'</button>';
const navs=NAV_ITEMS;
function notify(t){$("#toast").textContent=t;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),4200);}
function prefs(){document.body.classList.toggle("reduce",!!settings.reduce);document.body.classList.toggle("contrast",!!settings.contrast);document.documentElement.style.setProperty("--scale",settings.large?"1.12":"1");}
prefs();
const connection=new AdventureConnection({url:websocketUrl(location,room),playerId:id,WebSocketImpl:WebSocket,onState:view=>{if(view.spectator){$("#app").innerHTML='<div class="empty">This adventure belongs to another player. <a href="/">Open your own adventure</a></div>';return;}receiveView(view);},onError:error=>{pending=false;notify(error);draw();},onStatus:value=>{connected=value;if(value)return;pending=false;if(playback)finishPlayback();else if(V)draw();else $("#connection").textContent="Connection interrupted. Reconnecting…";}});
function receiveView(next){
 const previous=latestView;latestView=next;pending=false;
 if(playback){
  // Presence broadcasts for the same saved turn must not restart its animation.
  if(previous?.battle?.id===next.battle?.id&&previous?.battle?.round===next.battle?.round)return;
  finishPlayback();return;
 }
 if(previous&&router.current==="battle"&&previous.battle&&!previous.battle.result&&next.battle?.id===previous.battle.id&&next.battle.round===previous.battle.round+1&&next.battle.eventsRound===previous.battle.round&&next.battle.events?.length){
  void playTurn(previous,next);return;
 }
 if(previous?.battle?.round!==next.battle?.round)commands={};
 V=next;announceNotice(!!previous);draw();if(modalId!==null)detail(modalId);
}
function announceNotice(show=true){if(show&&V.notice!==lastNotice)notify(V.notice);lastNotice=V.notice;}
function finishPlayback(){
 playbackVersion++;playback?.cancel();playback=null;pending=false;commands={};
 if(latestView){V=latestView;announceNotice();draw();}
}
async function playTurn(previous,next){
 const version=++playbackVersion;
 playback=new BattleAnimator({speed:settings.battleSpeed===2?2:1,reduced:!!settings.reduce||matchMedia('(prefers-reduced-motion: reduce)').matches});
 const animator=playback;
 V={...previous,battle:{...previous.battle,log:["Turn "+previous.battle.round],events:[]}};
 closeModal();draw();
 document.querySelector('.battlehead')?.scrollIntoView({block:'start',behavior:animator.reduced?'auto':'smooth'});
 try{
  await animator.play(next.battle.events,frame=>{
   if(version!==playbackVersion||router.current!=="battle")return;
   V={...V,battle:{...V.battle,...frame}};draw();
  });
 }catch(error){console.error('Battle animation:',error);}
 finally{if(version===playbackVersion)finishPlayback();}
}
function send(a){if(pending||playback)return;if(!connection.sendAction(a)){notify("Reconnecting. Please try again shortly.");return;}pending=true;draw();}
const redrawWorkspace=()=>{if(V&&['training','collection','teams'].includes(router.current))draw();};
const trainingEditor=new TrainingEditor({fetchImpl:url=>fetch(url),onChange:redrawWorkspace,sendAction:send});
const boxView=new BoxView({onChange:redrawWorkspace});
const teamBuilder=new TeamBuilder({onChange:redrawWorkspace,sendAction:send});
const v2BattleScreen=new V2BattleScreen({onChange:()=>{if(V&&router.current==='battle')draw();},sendAction:send});
const damageInspector=new DamageInspector({fetchImpl:(...args)=>fetch(...args),getDraft:()=>trainingEditor.draft});
trainingEditor.load().catch(error=>notify(error.message));
function start(mode,gym){commands={};router.go("battle");const team=V.trainingV2.teams.find(entry=>entry.teamId===V.trainingV2.activeTeamId),regulationId=team?.buildIds.length===6?`alpha-${mode}`:'sandbox-v2';send({type:"battleV2.preview.start",mode,regulationId,...(gym===undefined?{}:{gym}),difficulty:gym===undefined?v2BattleScreen.difficulty:'hard'});}
function types(d){return '<div class="types">'+d.types.map(t=>'<span class="type" style="--c:'+V.colors[V.types.indexOf(t)]+'">'+t+'</span>').join("")+'</div>';}
function head(title,sub,kicker="YOUR ADVENTURE"){return '<div class="heading"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p>'+sub+'</p></div><span class="pill">✦ &nbsp; AETHER LEAGUE · SEASON 01</span></div>';}
function card(d,reveal=false,duplicate=false){const m=V.collection.find(m=>m.id===d.id);return '<button class="monster '+(!m?"locked ":"")+(reveal?"reveal":"")+'" style="--c:'+d.color+'" data-action="detail:'+d.id+'"><div class="serial"><span>#'+String(d.id+1).padStart(3,"0")+'</span><span class="rarity '+d.rarity+'">'+d.rarity.toUpperCase()+'</span></div>'+art(d.id)+(V.team.includes(d.id)?'<span class="check">✓ IN TEAM</span>':"")+'<h3>'+d.name+'</h3>'+types(d)+'<p style="font-size:10px">'+(duplicate?"+150 coins · duplicate":m?"Level "+m.level+" · "+d.ability.name:"Undiscovered · view details")+'</p></button>';}
function home(){
 return head("Welcome back, Challenger.","A new legend starts with your next battle.")+renderV2Tutorial(V)+
 '<section class="hero"><div class="herocopy"><div class="eyebrow">THE AETHER LEAGUE AWAITS</div><h2>YOUR TEAM.<br>YOUR TACTICS.<br><em>YOUR LEGEND.</em></h2><p>Forge an elemental team. Outsmart your rivals. Rise through the Aether League.</p>'+btn("Enter the arena &nbsp; ↗","nav:battle","primary")+'</div><div class="heroart"><div class="ring"></div>'+art(0)+art(1)+'<span class="spark">✦</span></div><div class="herotag">36 MONSTERS. ENDLESS POSSIBILITIES.</div></section>'+
 '<div class="dashboard"><div><div class="sectiontitle"><h2>Choose your battle</h2><small>AI CHALLENGERS · TEAM OF 4</small></div><div class="modegrid"><button class="modecard" data-action="start:single"><small>CLASSIC FORMAT</small><span class="modeicon">⚔</span><h3>Single Battle</h3><p>One monster at a time.<br>Every decision counts.</p><span class="arrow">Find a challenger &nbsp; →</span></button><button class="modecard double" data-action="start:double"><small>TACTICAL FORMAT</small><span class="modeicon">✧</span><h3>Double Battle</h3><p>Two monsters. One strategy.<br>Discover powerful synergies.</p><span class="arrow">Build your synergy &nbsp; →</span></button></div><div class="sectiontitle" style="margin-top:26px"><h2>Your battle team</h2>'+btn("Manage team →","nav:collection","small ghost")+'</div><div class="teamstrip">'+V.team.map(id=>{const m=V.collection.find(x=>x.id===id);return '<button class="mini" data-action="detail:'+id+'">'+art(id)+'<b>'+V.catalog[id].name+'</b><small>Lv. '+m.level+' · '+V.catalog[id].types[0]+'</small></button>';}).join("")+'</div></div><aside><div class="panel"><div class="sectiontitle"><h2>Your journey</h2><span style="color:var(--gold)">✧</span></div>'+[
 ["Build your collection",V.collection.length,36,"36 original companions"],
 ["Claim the six badges",V.badges.length,6,"Conquer every gym"],
 ["First league victory",Math.min(V.wins,1),1,"+300 crystals in your mailbox"]
 ].map(([n,v,max,r])=>'<div class="mission"><b>'+n+'</b><small>'+v+' / '+max+' completed</small><div class="progress"><i style="width:'+100*v/max+'%"></i></div><span class="reward">'+r+'</span></div>').join("")+'</div><div class="panel" style="margin-top:15px;background:linear-gradient(120deg,#342b3e,#1c2436)"><div class="eyebrow" style="color:#ccb1eb">THE CELESTIAL CALL</div><h3 style="margin:10px 0">Meet your next champion</h3><p style="font-size:11px">Epic or better every 10 summons.</p>'+btn("Visit summon portal →","nav:summon","small ghost")+'</div></aside></div>';
}
function archive(training=false){
 if(training)return head("Training room","Tạo build chiến thuật với chỉ số, Ability, bốn chiêu và held item.")+trainingEditor.render(V,{art})+damageInspector.render(V,trainingEditor.catalog);
 return head("Monster archive","Theo dõi toàn bộ 36 loài, quyền sở hữu vĩnh viễn hoặc trial, build và đội đang sử dụng.")+boxView.render(V,trainingEditor.catalog,{art});
}
function teamsPage(){return head("Team builder","Ghép tối đa sáu Mon, kiểm tra regulation và chia sẻ blueprint an toàn.")+teamBuilder.render(V,trainingEditor.catalog,{art});}
function summon(){return head("Summon portal","Call a new companion from beyond the veil.","THE CELESTIAL CALL")+
 '<section class="summonhero"><div class="eyebrow" style="color:#d1b3f1">PERMANENT BANNER · ALL 36 SPECIES</div><h2>A NEW BOND.<br>A NEW BEGINNING.</h2><p>Every summon brings a new possibility. Discover rare elemental companions to complete your team.</p>'+art(35)+'<div class="actions">'+btn("✦ Summon ×1 · 100","summon:1","orange",pending||V.gems<100)+btn("✦ Summon ×10 · 1,000","summon:10","primary",pending||V.gems<1000)+'</div></section><div class="rates"><span>Common 60%</span><span>Rare 30%</span><span>Epic 8%</span><span style="color:var(--gold)">Legendary 2%</span></div><div class="panel"><div class="sectiontitle"><b>Legendary guarantee</b><small>'+V.pity+' / 50</small></div><div class="progress"><i style="width:'+V.pity*2+'%"></i></div><p style="font-size:11px">A Legendary is guaranteed by pull 50; resets on a Legendary. Every 10th total pull is Epic or better. Rates above are base rates before guarantees. Duplicates become 150 coins. Currency is earned through play; no real-money purchases.</p></div>'+
 (V.reveal.length?'<div class="sectiontitle" style="margin-top:25px"><h2>Your summons</h2></div><div class="grid">'+V.reveal.map(r=>card(V.catalog[r.id],true,r.duplicate)).join("")+'</div>':"");}
const gyms=["Ember Coast","Wild Current","Frozen Quarry","Skyfall Spire","Eclipse Garden","Astral Citadel"];
function gym(){return head("The road to champion","Six leaders. Six badges. One place at the top.")+'<div class="filters"><label>Battle format &nbsp; <select id="gymmode"><option value="single">Single battle</option><option value="double">Double battle</option></select></label></div><div class="gymgrid">'+gyms.map((n,i)=>'<div class="panel gym '+(i>V.badges.length?"locked":"")+'">'+art(i*6+1)+'<div class="eyebrow">GYM 0'+(i+1)+' · LEVEL '+(5+i*3)+'</div><h2>'+n+'</h2><p>'+V.catalog[i*6].types[0]+' / '+V.catalog[i*6+3].types[0]+' specialists</p><span class="reward">'+(V.badges.includes(i)?"✦ Badge earned":"First victory: +380 crystals · +680 coins")+'</span><br>'+btn(i>V.badges.length?"Locked":V.badges.includes(i)?"Challenge again →":"Challenge leader →","gym:"+i,i===V.badges.length?"primary":"",i>V.badges.length)+'</div>').join("")+'</div>';}
function mail(){return head("Mailbox","League news and milestone rewards, all in one place.")+["Welcome to Aether","Your first victory","A badge to remember"].map((n,i)=>{
 const locked=i===1&&V.wins<1||i===2&&V.badges.length<1,done=V.mail.includes(i);
 return '<div class="panel mailrow"><div class="mailicon">✉</div><div class="mailtext"><div class="eyebrow">AETHER LEAGUE · MILESTONE '+(i+1)+'</div><h3>'+n+'</h3><p>'+["Your starter team is ready. Here is a little help for the journey.","Win your first battle to unlock this reward.","Earn your first gym badge to unlock this reward."][i]+'</p><span class="reward">◈ '+[500,400,800][i]+' coins &nbsp; ✦ '+[500,300,500][i]+' crystals</span></div>'+btn(done?"Claimed":locked?"Locked":"Claim rewards","claim:"+i,"primary",done||locked||pending)+'</div>';}).join("");}
function settingsPage(){return head("Settings","Make the arena feel like home.")+'<div class="panel">'+[
 ["reduce","Reduced motion","Show quick battle updates without movement, particles, or flashes."],
 ["contrast","High contrast","Increase contrast for secondary text and borders."],
 ["large","Larger text","Increase interface text size for easier reading."]
 ].map(([key,title,desc])=>'<label class="settingsrow"><div><b>'+title+'</b><p>'+desc+'</p></div><input type="checkbox" data-setting="'+key+'" '+(settings[key]?"checked":"")+'></label>').join("")+'<div class="settingsrow"><div><b>Adventure save</b><p>Saved automatically to this browser’s adventure identity. Keep browser data to return to your collection.</p></div><span class="pill">'+(connected?"Connected":"Reconnecting")+'</span></div><div class="settingsrow"><div><b>Audio</b><p>This first version is silent.</p></div><span class="rarity">NO AUDIO TRACK</span></div></div>';}
function guide(){return head("Field guide","Everything you need to become an Aether Champion.")+'<div class="helpgrid">'+[
 ["01 · Build a team","Open Team Builder and save six different species. Team Preview selects three for Single or four for Double; the first one or two choices become your leads."],
 ["02 · Plan your turn","Choose a move, target, or switch for every active Mon. Switches, move priority, effective Speed, then a seeded tie key determine action order. Replacement happens in its own phase."],
 ["03 · Manage PP","Each move has its own PP. Guard, misses and immunities still spend PP; when all moves are empty the Mon uses Struggle. Same-type moves gain 50% damage."],
 ["04 · Read the battlefield","Weather, terrain and side conditions use separate layers with visible durations. Dual-type effectiveness multiplies both weaknesses and resistances; the field chips show every active layer."],
 ["05 · Equip and train","Training assigns 32 stat points, alignment, one of two Abilities, four moves and one of 12 held items. Damage Inspector previews the exact server calculation without rewards."],
 ["06 · Earn your collection","Alpha exhibition wins grant 180 coins and 80 crystals; losses or draws grant 60 and 20. Gym first clear adds 500 and 300. Sandbox and surrender grant nothing."]
 ].map(([h,p])=>'<div class="panel"><h3>'+h+'</h3><p>'+p+'</p></div>').join("")+'</div><div class="panel" style="margin-top:20px"><h3>Weather & passive abilities</h3>'+V.catalog.filter((_,i)=>i%3===0).map(m=>'<p style="font-size:12px"><b>'+m.ability.name+'</b> · '+m.ability.desc+'</p>').join("")+btn("Open type chart","chart","primary")+'</div>';}

function live(side){return V.battle[side].map((m,i)=>({m,i})).filter(x=>x.m.hp>0&&x.m.slot>=0).sort((a,b)=>a.m.slot-b.m.slot);}
function animationBar(){return '<div class="battle-announcer" role="status" aria-live="polite"><div><strong>'+(playback?esc(playback.currentCaption?.title||'Battle in motion…'):'Choose your moves')+'</strong><span>'+(playback?esc(playback.currentCaption?.subtitle||'Playing actions in speed order'):'Elemental attacks · Hold items · Team synergy')+'</span></div><div class="playback-controls"><label>Speed <select data-battle-speed aria-label="Battle animation speed" '+(playback?'disabled':'')+'><option value="1" '+(settings.battleSpeed!==2?'selected':'')+'>1×</option><option value="2" '+(settings.battleSpeed===2?'selected':'')+'>2×</option></select></label>'+(playback?btn('Skip ⏭','skip-animation','small ghost'):'')+'</div></div>';}
function ensureCommands(){for(const {m,i} of live("allies"))if(!commands[i])commands[i]={kind:"move",actor:i,move:0,target:live("enemies")[0]?.i};}
function fighter(m,side,i){return '<div class="fighter" data-fighter="'+side+'-'+i+'">'+art(m.id)+'<div class="hpbox"><strong>'+V.catalog[m.id].name+'<span>Lv.'+m.level+'</span></strong><div class="progress"><i class="'+(m.hp<m.max*.3?"low":"")+'" style="width:'+m.hp/m.max*100+'%"></i></div><small>'+m.hp+'/'+m.max+' HP · '+m.energy+' EN'+(m.status?" · "+m.status.toUpperCase():"")+'</small></div></div>';}
function battle(){
 if(V.battle?.result)return head("Legacy battle complete","Kết quả v1 đã được lưu an toàn trước khi nâng adventure.")+`<section class="panel v2-result"><small>LEGACY V1 · MATCH COMPLETE</small><h2>${esc(V.battle.result)}</h2><p>+${V.battle.reward?.coins||0} coins · +${V.battle.reward?.gems||0} crystals</p>${btn("Tiếp tục sang Tactical Alpha","legacy-finish","primary")}</section>`;
 if(!V.battle)return head("Battle arena","Chọn đội hình qua Team Preview rồi chiến đấu bằng phase engine v2.")+v2BattleScreen.render(V,trainingEditor.catalog,{art});
 const b=V.battle;if(!b)return head("Battle arena","Choose your format and face an AI challenger.")+'<div class="modegrid"><div class="panel"><h2>Single Battle</h2><p>One active monster per side. Bring up to four.</p>'+btn("Start single battle","start:single","primary")+'</div><div class="panel"><h2>Double Battle</h2><p>Two active monsters per side. Combine their strengths.</p>'+btn("Start double battle","start:double","primary")+'</div></div><div class="panel" style="margin-top:20px"><h3>Ready your team</h3><p>Manage your lead monsters, held items and levels before entering.</p>'+btn("Manage battle team →","nav:collection","ghost")+'</div>';
 ensureCommands();
 return '<div class="battlehead"><div><div class="eyebrow">'+(b.gym===null?"EXHIBITION MATCH":gyms[b.gym].toUpperCase())+'</div><h1>'+ (b.mode==="double"?"Double":"Single")+' Battle <span style="color:var(--muted);font-size:18px">/ Turn '+b.round+'</span></h1></div>'+btn("Type chart","chart","small ghost")+'</div>'+animationBar()+'<div class="arena" data-playing="'+!!playback+'" data-weather="'+b.weather+'"><div class="fieldlabel">'+b.weather.toUpperCase()+' '+(b.weatherTurns?"· "+b.weatherTurns+" TURNS":"")+'</div><div class="fighters enemies">'+live("enemies").map(({m,i})=>fighter(m,"enemies",i)).join("")+'</div><div class="fighters allies">'+live("allies").map(({m,i})=>fighter(m,"allies",i)).join("")+'</div></div>'+
 (b.result?'<div class="result"><div class="eyebrow">MATCH COMPLETE</div><h2>'+b.result+'</h2><p>+'+b.reward.coins+' coins &nbsp; +'+b.reward.gems+' crystals</p>'+btn("Battle again","start:"+b.mode,"primary")+' '+btn("Return to command center","nav:home","ghost")+'</div>':
 '<div class="battlemain"><div><div class="commands" '+(b.mode==="single"?'style="grid-template-columns:1fr"':"")+'>'+live("allies").map(({m,i})=>{
 const d=V.catalog[m.id],c=commands[i];return '<div class="panel command"><h3>'+d.name+' <span style="color:var(--accent);font-size:11px">· '+m.energy+'/5 ENERGY</span></h3><div class="moves">'+d.moves.map((mv,k)=>'<button class="move '+(c.kind==="move"&&c.move===k?"chosen":"")+'" style="--c:'+V.colors[V.types.indexOf(mv.type)]+'" data-action="move:'+i+':'+k+'" '+(m.energy<mv.cost?"disabled":"")+'><b>'+mv.name+'</b><small>'+mv.type+' · '+(mv.power?mv.power+" PWR":"UTILITY")+' · '+mv.cost+' EN</small></button>').join("")+'</div><select class="targetselect" data-target="'+i+'" aria-label="Target for '+d.name+'">'+live("enemies").map(t=>'<option value="'+t.i+'" '+(c.target===t.i?"selected":"")+'>'+V.catalog[t.m.id].name+' · '+t.m.hp+' HP</option>').join("")+'</select><select class="targetselect" data-switch="'+i+'" aria-label="Switch '+d.name+'"><option value="-1">Use selected move</option>'+b.allies.map((r,j)=>({r,j})).filter(x=>x.r.hp>0&&x.r.slot<0).map(({r,j})=>'<option value="'+j+'" '+(c.kind==="switch"&&c.to===j?"selected":"")+'>Switch → '+V.catalog[r.id].name+' ('+r.hp+' HP)</option>').join("")+'</select></div>';}).join("")+'</div><div class="turnfooter">'+btn(pending?"Resolving…":"Resolve turn →","resolve","primary",pending)+btn("Surrender","surrender","small ghost",pending)+'<small>Actions resolve in speed order.</small></div><div class="reserves">'+b.allies.filter(m=>m.slot<0).map(m=>'<span>'+V.catalog[m.id].name+' · '+(m.hp?m.hp+" HP":"Fainted")+'</span>').join("")+'</div></div><div class="panel battlelog"><h3>Battle log</h3>'+b.log.map(l=>'<p>'+esc(l)+'</p>').join("")+'</div></div>')+(b.result?'<div class="panel battlelog" style="margin-top:16px">'+b.log.map(l=>'<p>'+esc(l)+'</p>').join("")+'</div>':"");
}
function draw(){
 if(!V)return;
 const page=router.current,t=performance.now(),content={home,collection:()=>archive(false),teams:teamsPage,training:()=>archive(true),summon,gym,mail,settings:settingsPage,guide,battle}[page]();
 $("#app").innerHTML='<div class="shell"><aside class="sidebar"><div class="brand"><div class="brandmark">✦</div><div class="brandname">AETHER<small>CHAMPIONS</small></div></div><div class="navlabel">PLAY & DISCOVER</div><div class="navs">'+navs.map(([k,icon,label])=>'<button class="nav '+(page===k?"active":"")+'" data-action="nav:'+k+'"><span class="icon">'+icon+'</span>'+label+(k==="mail"&&!V.mail.includes(0)?'<span class="badge">1</span>':"")+'</button>').join("")+'</div><div class="sidefoot"><span class="online">● '+(connected?"ADVENTURE SAVED":"RECONNECTING")+'</span><p>Original monster battle RPG<br>Version 1.0 · Solo adventure</p></div></aside><div><header class="topbar"><div class="breadcrumb">Aether League &nbsp; / &nbsp; <b>'+navs.find(n=>n[0]===page)[2]+'</b></div><div class="resources"><div class="currency"><span>◈</span>'+V.coins.toLocaleString()+'</div><div class="currency crystal"><span>✦</span>'+V.gems.toLocaleString()+'</div><div class="avatar">C</div></div></header><main class="content">'+content+'<footer class="bottomnote"><span>✦ &nbsp; AETHER CHAMPIONS</span><span>'+V.collection.length+' / 36 DISCOVERED &nbsp; · &nbsp; '+V.badges.length+' / 6 BADGES</span></footer></main></div></div>';
 if(playback){
  document.querySelectorAll('.commands button,.commands select,.turnfooter button').forEach(el=>{el.disabled=true;});
  const resolve=document.querySelector('[data-action="resolve"]');if(resolve)resolve.textContent='Playing turn…';
 }
 if(new URLSearchParams(location.search).has("debug"))$("#app").insertAdjacentHTML("beforeend",'<div class="debug">Render '+(performance.now()-t).toFixed(1)+' ms · '+document.querySelectorAll("svg").length+' visible creatures</div>');
}
function closeModal(){modalId=null;$("#modal").innerHTML="";}
function detail(id){
 modalId=id;const d=V.catalog[id],m=V.collection.find(x=>x.id===id),inTeam=V.team.includes(id),level=m?.level||5;
 $("#modal").innerHTML='<div class="modalback"><section class="modal" role="dialog" aria-modal="true" aria-label="'+d.name+' details">'+btn("✕","close","close small")+'<div class="detail"><div>'+art(id)+'<div class="stats">'+[["HP",d.hp+level*6],["ATK",d.attack+level*2],["DEF",d.defense+level*2],["SPD",d.speed+level*2]].map(([k,v])=>'<div class="stat">'+k+'<b>'+v+'</b></div>').join("")+'</div><p>Stats include level growth. Abilities and held items apply during battle.</p></div><div><span class="rarity '+d.rarity+'">'+d.rarity.toUpperCase()+' · #'+String(id+1).padStart(3,"0")+'</span><h2>'+d.name+'</h2>'+types(d)+'<p><b>'+d.ability.name+'</b><br>'+d.ability.desc+'</p><div class="movelist">'+d.moves.map(mv=>'<div class="movedetail"><span style="color:'+V.colors[V.types.indexOf(mv.type)]+'">'+mv.type+'</span><b>'+mv.name+'</b><small>'+mv.power+' power · '+mv.cost+' energy</small><p>'+mv.desc+(["burn","poison","slow"].includes(mv.effect)?" Applies "+mv.effect+" for 3 turns.":"")+'</p></div>').join("")+'</div></div></div>'+
 (m?'<div class="detailactions">'+btn(inTeam?"Remove from team":"Add to team","team:"+id,"primary",pending||(!inTeam&&V.team.length>=4)||(inTeam&&V.team.length===1))+(inTeam?btn("Make lead","lead:"+id,"",pending):"")+btn(m.level>=30?"Maximum level":"Train Lv. "+m.level+" → "+(m.level+1)+" · "+m.level*30+" coins","train:"+id,"",pending||m.level>=30||V.coins<m.level*30)+'</div><div class="detailactions"><label>Held item &nbsp;<select id="equip" data-id="'+id+'">'+V.items.map((v,i)=>'<option value="'+i+'" '+(m.item===i?"selected":"")+'>'+v.name+'</option>').join("")+'</select></label><p>'+V.items[m.item].desc+'</p></div>':'<p class="empty">Summon this species to train it and add it to your team.</p>')+'</section></div>';
}
function chart(){
 modalId=null;$("#modal").innerHTML='<div class="modalback"><section class="modal" role="dialog" aria-modal="true" aria-label="Type effectiveness">'+btn("✕","close","close small")+'<h2>Type effectiveness</h2><p style="font-size:12px">Rows attack → columns defend. Dual types multiply. 2× strong · ½× resisted · 0× immune.</p><div class="tablewrap"><table class="chart"><thead><tr><th>ATK ↓ DEF →</th>'+V.types.map(t=>'<th>'+t+'</th>').join("")+'</tr></thead><tbody>'+V.types.map((t,i)=>'<tr><th>'+t+'</th>'+V.typeChart[i].map(v=>'<td class="'+(v>1?"good":v<1?"bad":"")+'">'+(v===.5?"½":v)+'×</td>').join("")+'</tr>').join("")+'</tbody></table></div></section></div>';
}
document.addEventListener("click",e=>{
 const el=e.target.closest("[data-action],[data-training],[data-box],[data-team],[data-v2battle],[data-damage]");if(!el||el.disabled)return;if(el.dataset.damage){void damageInspector.handleClick(el,V,trainingEditor.catalog);return;}if(el.dataset.training){trainingEditor.handleClick(el,V);return;}if(el.dataset.box){boxView.handleClick(el,V,{openTraining:monId=>{trainingEditor.select(V.trainingV2,monId);router.go('training');draw();}});return;}if(el.dataset.team){teamBuilder.handleClick(el,V,trainingEditor.catalog);return;}if(el.dataset.v2battle){v2BattleScreen.handleClick(el,V,trainingEditor.catalog);return;}const [a,b,c]=el.dataset.action.split(":");
 if(a==="skip-animation"){finishPlayback();return;}
 if(playback){if(a!=="nav")return;finishPlayback();}
 if(a==="nav"&&router.go(b)){closeModal();draw();window.scrollTo(0,0);}
 if(a==="start")start(b);
 if(a==="detail")detail(+b);
 if(a==="close")closeModal();
 if(a==="chart")chart();
 if(a==="gym")start($("#gymmode").value,+b);
 if(a==="summon")send({type:"summon",count:+b});
 if(a==="claim")send({type:"claim",id:+b});
 if(a==="train")send({type:"train",id:+b});
 if(a==="team")send({type:"team",ids:V.team.includes(+b)?V.team.filter(i=>i!==+b):[...V.team,+b]});
 if(a==="lead")send({type:"team",ids:[+b,...V.team.filter(i=>i!==+b)]});
 if(a==="move"){commands[+b]={...commands[+b],kind:"move",move:+c};draw();}
 if(a==="resolve")send({type:"turn",round:V.battle.round,commands:live("allies").map(x=>commands[x.i])});
 if(a==="surrender"){if(confirm("Surrender this battle? No rewards will be granted."))send({type:"surrender"});}
 if(a==="legacy-finish")send({type:"legacy.finish"});
});
document.addEventListener("change",e=>{
 const t=e.target;
 if(damageInspector.handleInput(t,V,trainingEditor.catalog))return;
 if(v2BattleScreen.handleInput(t))return;
 if(boxView.handleInput(t)||teamBuilder.handleInput(t))return;
 if(trainingEditor.handleInput(t))return;
 if(t.hasAttribute('data-battle-speed')){settings.battleSpeed=Number(t.value)===2?2:1;browserStore.saveSettings();return;}
 if(playback)return;
 if(t.dataset.setting){settings[t.dataset.setting]=t.checked;browserStore.saveSettings();prefs();}
 if(t.id==="equip")send({type:"equip",id:+t.dataset.id,item:+t.value});
 if(t.dataset.target!==undefined)commands[+t.dataset.target].target=+t.value;
 if(t.dataset.switch!==undefined){let i=+t.dataset.switch;commands[i]=+t.value<0?{kind:"move",actor:i,move:0,target:live("enemies")[0].i}:{kind:"switch",actor:i,to:+t.value};draw();}
});
document.addEventListener("input",e=>{const t=e.target,selector=t.dataset.boxField!==undefined?`[data-box-field="${t.dataset.boxField}"]`:t.dataset.teamField!==undefined?`[data-team-field="${t.dataset.teamField}"]`:null,pos=t.selectionStart;if(boxView.handleInput(t)||teamBuilder.handleInput(t)){const next=selector&&document.querySelector(selector);next?.focus();if(next?.setSelectionRange&&pos!==null)next.setSelectionRange(pos,pos);return;}trainingEditor.handleInput(t);});
document.addEventListener("keydown",e=>{if(e.code==="Escape")closeModal();if(e.code==="Tab"&&$("#modal").children.length){const els=[...$("#modal").querySelectorAll("button:not(:disabled),select,input")];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
connection.start();

// Leaving/resizing the scene commits its already-saved outcome and cancels effects.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback)finishPlayback();});
window.addEventListener('resize',()=>{if(playback)finishPlayback();});
