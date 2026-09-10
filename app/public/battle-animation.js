// Purely visual playback. Damage, targets and intermediate states come from the server.
const PALETTE={Flame:'#ff9d50',Tide:'#59dcff',Bloom:'#a3f595',Volt:'#ffe777',Frost:'#bcf3ff',Stone:'#dfbb87',Gale:'#a0ffe1',Shadow:'#b49bff',Light:'#fff1af',Venom:'#da8fff',Steel:'#d6e8ff',Astral:'#ffa8e6'};
const ICON={Flame:'♨',Tide:'◉',Bloom:'❧',Volt:'ϟ',Frost:'❄',Stone:'◆',Gale:'≋',Shadow:'☾',Light:'✦',Venom:'◌',Steel:'✧',Astral:'✺'};
const ease=t=>1-Math.pow(1-t,3);
const mix=(a,b,t)=>a+(b-a)*t;
const unit=(side,index)=>document.querySelector(`[data-fighter="${side}-${index}"]`);
const sprite=el=>el?.querySelector('.art svg');

export class BattleAnimator {
  constructor({speed=1,reduced=false}={}){this.speed=speed;this.reduced=reduced;this.aborted=false;this.animations=new Set();this.waits=new Set();this.nodes=new Set();}
  cancel(){this.aborted=true;for(const a of this.animations)a.cancel();for(const end of [...this.waits])end();for(const n of this.nodes)n.remove();this.nodes.clear();}
  async wait(ms){if(this.aborted)return;await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.waits.delete(done);resolve();};const timer=setTimeout(done,ms/this.speed);this.waits.add(done);});}
  async animate(el,frames,duration){
    if(!el||this.aborted||this.reduced)return;
    const a=el.animate(frames,{duration:duration/this.speed,easing:'cubic-bezier(.2,.8,.2,1)',fill:'none'});this.animations.add(a);
    try{await a.finished;}catch{}finally{this.animations.delete(a);}
  }
  caption(title,subtitle,type='Light'){
    this.currentCaption={title,subtitle,type};
    const bar=document.querySelector('.battle-announcer');if(!bar)return;
    bar.style.setProperty('--fx-color',PALETTE[type]||PALETTE.Light);
    bar.querySelector('strong').textContent=title;
    bar.querySelector('span').textContent=subtitle;
    bar.dataset.active='true';
  }
  point(side,index){
    const el=unit(side,index)?.querySelector('.art'),arena=document.querySelector('.arena');if(!el||!arena)return null;
    const r=el.getBoundingClientRect(),a=arena.getBoundingClientRect();
    return {x:r.left-a.left+r.width*.5,y:r.top-a.top+r.height*.46};
  }
  async canvas(duration,paint){
    const arena=document.querySelector('.arena');if(!arena||this.aborted||this.reduced)return;
    const node=document.createElement('canvas');node.className='battle-fx';node.setAttribute('aria-hidden','true');
    const w=arena.clientWidth,h=arena.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    node.width=w*dpr;node.height=h*dpr;arena.append(node);this.nodes.add(node);
    const ctx=node.getContext('2d');ctx.scale(dpr,dpr);
    await new Promise(resolve=>{
      let raf,start;const finish=()=>{cancelAnimationFrame(raf);this.waits.delete(finish);node.remove();this.nodes.delete(node);resolve();};
      this.waits.add(finish);
      const tick=now=>{if(this.aborted||!node.isConnected){finish();return;}start??=now;const p=Math.min(1,(now-start)/(duration/this.speed));ctx.clearRect(0,0,w,h);ctx.save();paint(ctx,p,w,h);ctx.restore();if(p<1)raf=requestAnimationFrame(tick);else finish();};
      raf=requestAnimationFrame(tick);
    });
  }
  hp(frame){
    for(const side of ['allies','enemies'])frame[side].forEach((m,i)=>{
      const el=unit(side,i);if(!el)return;
      const bar=el.querySelector('.progress i');bar.style.width=m.hp/m.max*100+'%';bar.classList.toggle('low',m.hp<m.max*.3);
      el.querySelector('.hpbox small').textContent=`${m.hp}/${m.max} HP · ${m.energy} EN${m.status?' · '+m.status.toUpperCase():''}`;
    });
  }
  async play(events,onFrame){
    for(const event of events){
      if(this.aborted)return;
      await this.one(event,onFrame);
      if(this.aborted)return;
      await this.wait(this.reduced?70:100);
    }
  }
  async one(e,onFrame){
    const actor=unit(e.side,e.actor),a=this.point(e.side,e.actor);
    const commit=()=>{if(!this.aborted)onFrame(e.frame);};
    if(e.kind==='switch'||e.kind==='entry'){
      this.caption(e.kind==='switch'?'Switching companions':`${e.name} enters!`,e.name,'Astral');
      if(e.kind==='switch')await this.animate(sprite(actor),[{transform:'scale(1)',opacity:1},{transform:'scale(.15)',opacity:0}],270);
      commit();
      const incoming=unit(e.side,e.kind==='switch'?e.incoming:e.actor);
      this.caption(`${e.name} enters!`,'Ready for battle','Astral');
      await this.animate(sprite(incoming),[{transform:'translateY(15px) scale(.25)',opacity:0},{transform:'translateY(-5px) scale(1.06)',opacity:1,offset:.7},{transform:'none',opacity:1}],420);
      return;
    }
    if(e.kind==='upkeep'){
      this.caption(e.change>0?'Recovery':e.condition||'Field damage',e.name,e.change>0?'Bloom':'Venom');
      this.hp(e.frame);
      if(a)await this.canvas(560,(ctx,p)=>{aura(ctx,a,p,e.change>0?'Bloom':'Venom','heal');floating(ctx,a,p,e.change>0?'+'+e.change:String(e.change),e.change>0?'RECOVERED':String(e.condition||''),e.change>0?'#a3f595':'#ebadf5');});
      if(e.frame[e.side][e.actor].hp===0)await this.animate(sprite(actor),[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(28px) scale(.7)'}],210);
      commit();return;
    }
    if(e.kind!=='move'){commit();return;}
    const type=e.move.type,color=PALETTE[type]||'#fff';
    this.caption(`${ICON[type]||'✦'} ${e.move.name}`,`${e.name} · ${type.toUpperCase()}` ,type);
    if(this.reduced){commit();await this.wait(160);return;}
    if(!a){commit();return;}
    if(!e.move.power){
      await this.animate(sprite(actor),[{transform:'scale(1)'},{transform:'translateY(-10px) scale(1.08)',offset:.5},{transform:'none'}],280);
      this.hp(e.frame);
      await this.canvas(650,(ctx,p,w,h)=>{
        aura(ctx,a,p,type,e.move.effect);
        if(e.move.effect==='weather'){
          const r=40+ease(p)*Math.max(w,h);ctx.strokeStyle=color;ctx.lineWidth=7;ctx.globalAlpha=(1-p)*.38;ctx.beginPath();ctx.arc(a.x,a.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        }
        floating(ctx,a,p,e.healing>0?'+'+e.healing:e.move.effect==='guard'?'GUARD':e.move.effect==='boost'?'ATK ↑':e.move.weather||'FIELD',e.healing>0?'RECOVERED':'',color);
      });
      commit();return;
    }
    const targets=e.targets.map(t=>({...t,point:this.point(t.side,t.index),element:unit(t.side,t.index)})).filter(t=>t.point);
    const contact=/Fang|Lash|Hammer|Slash|Claw/.test(e.move.name);
    const first=targets[0]?.point||a,dx=first.x-a.x,dy=first.y-a.y;
    const length=Math.max(1,Math.hypot(dx,dy)),reach=Math.min(length*.35,70);
    await Promise.all([
      this.animate(sprite(actor),[{transform:'scale(1)'},{transform:`translate(${-dx/length*9}px,4px) scale(.93,1.06)`,offset:.6},{transform:'scale(1.1)'}],240),
      this.canvas(240,(ctx,p)=>charge(ctx,a,p,type))
    ]);
    await Promise.all([
      this.animate(sprite(actor),[{transform:'none'},{transform:contact?`translate(${dx/length*reach}px,${dy/length*reach}px) scale(1.09)`:'translateY(-8px) scale(1.06)',offset:.35},{transform:'none'}],500),
      this.canvas(430,(ctx,p)=>{for(const t of targets)projectile(ctx,a,t.point,p,type,contact,e.move.effect==='spread');})
    ]);
    if(this.aborted)return;
    this.hp(e.frame);
    await Promise.all([
      this.canvas(660,(ctx,p)=>{for(const t of targets){
        if(t.blocked)aura(ctx,t.point,p,'Tide','guard');else impact(ctx,t.point,p,type,t.effectiveness===0?.25:1);
        const text=t.blocked?'BLOCKED':t.effectiveness===0?'IMMUNE':'−'+t.damage;
        const sub=t.blocked?'':t.effectiveness>1?'SUPER EFFECTIVE':t.effectiveness<1&&t.effectiveness>0?'RESISTED':t.status?t.status.toUpperCase():'';
        floating(ctx,t.point,p,text,sub,t.blocked||t.effectiveness===0?'#c4d6ee':t.effectiveness>1?'#ffe5a8':'#ffffff');
      }}),
      ...targets.map(t=>this.animate(sprite(t.element),t.blocked||!t.damage?[{filter:'brightness(1)'},{filter:'brightness(1.3)',offset:.5},{filter:'brightness(1)'}]:[{transform:'none',filter:'brightness(1)'},{transform:`translate(${Math.sign(t.point.x-a.x)*10}px,-2px) rotate(5deg)`,filter:'brightness(1.65)',offset:.2},{transform:'translate(-5px,1px) rotate(-3deg)',filter:'brightness(1)',offset:.5},{transform:'none',filter:'brightness(1)'}],370))
    ]);
    await Promise.all(targets.filter(t=>t.fainted).map(t=>this.animate(sprite(t.element),[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(28px) scale(.65)'}],230)));
    commit();
  }
}

function ring(ctx,x,y,r,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.stroke();}
function glow(ctx,color){ctx.fillStyle=color;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;}
function star(ctx,x,y,r){ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,d=i%2?r*.3:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fill();}
function charge(ctx,a,p,type){
  const c=PALETTE[type];glow(ctx,c);ctx.globalAlpha=Math.sin(p*Math.PI)*.8;
  ring(ctx,a.x,a.y,50-25*p,c,2);
  for(let i=0;i<8;i++){const q=i*Math.PI/4+p,rad=55*(1-p)+10;star(ctx,a.x+Math.cos(q)*rad,a.y+Math.sin(q)*rad,3+3*p);}
}
function projectile(ctx,a,b,p,type,contact,spread){
  const c=PALETTE[type],t=p*p*(3-2*p),x=mix(a.x,b.x,t),y=mix(a.y,b.y,t)-Math.sin(p*Math.PI)*(type==='Stone'?45:14);
  const angle=Math.atan2(b.y-a.y,b.x-a.x);glow(ctx,c);ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=Math.min(1,p*8);
  if(type==='Volt'){
    ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x,a.y);for(let i=1;i<=12;i++){const q=i/12;ctx.lineTo(mix(a.x,x,q)+Math.sin(i*13+p*16)*10,mix(a.y,y,q)+(i%2?9:-9));}ctx.stroke();ctx.lineWidth=1.5;ctx.strokeStyle='#fff';ctx.stroke();star(ctx,x,y,18);return;
  }
  if(type==='Light'){
    ctx.globalAlpha*=.65;ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();star(ctx,x,y,23);return;
  }
  for(let i=0;i<8;i++){
    const q=Math.max(0,t-i*.027),tx=mix(a.x,b.x,q),ty=mix(a.y,b.y,q);
    ctx.globalAlpha=(1-i/8)*.35;ctx.beginPath();ctx.arc(tx,ty,Math.max(2,9-i),0,7);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.translate(x,y);ctx.rotate(angle);
  if(type==='Flame'){
    ctx.fillStyle='#ff7140';ctx.beginPath();ctx.moveTo(-36,-13);ctx.quadraticCurveTo(-7,-8,0,-19);ctx.quadraticCurveTo(33,-6,10,13);ctx.quadraticCurveTo(-8,23,-36,8);ctx.lineTo(-21,0);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe7a3';ctx.beginPath();ctx.ellipse(3,0,12,7,0,0,7);ctx.fill();
  }else if(type==='Tide'){
    ring(ctx,0,0,15,c,4);ring(ctx,-9,0,23,c,2);ctx.fillStyle='#d5fbff';ctx.beginPath();ctx.ellipse(5,0,15,8,0,0,7);ctx.fill();
  }else if(type==='Bloom'){
    for(let i=-1;i<=1;i++){ctx.save();ctx.translate(i*18,Math.sin(p*9+i)*12);ctx.rotate(i*.5);ctx.beginPath();ctx.moveTo(-17,0);ctx.quadraticCurveTo(0,-17,18,0);ctx.quadraticCurveTo(0,17,-17,0);ctx.fill();ctx.restore();}
  }else if(type==='Frost'||type==='Steel'){
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(23+i*4,i*13);ctx.lineTo(-12,i*13-6);ctx.lineTo(-20,i*13);ctx.lineTo(-12,i*13+6);ctx.closePath();ctx.fill();}
  }else if(type==='Stone'){
    ctx.rotate(p*7);ctx.beginPath();for(let i=0;i<7;i++){const r=i%2?15:21;ctx.lineTo(Math.cos(i*7/6)*r,Math.sin(i*7/6)*r);}ctx.closePath();ctx.fill();ctx.fillStyle='#f4dbb3';ctx.beginPath();ctx.moveTo(-10,-12);ctx.lineTo(8,-14);ctx.lineTo(-2,4);ctx.closePath();ctx.fill();
  }else if(type==='Gale'||type==='Shadow'){
    ctx.lineWidth=5;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(i*-12,0,16+i*5,-1.3,1.3);ctx.stroke();}
  }else if(type==='Venom'){
    for(let i=0;i<5;i++){const ox=Math.sin(i*6+p*4)*17,oy=Math.cos(i*3+p*4)*13;ctx.beginPath();ctx.arc(ox,oy,8+(i%2)*4,0,7);ctx.fill();ctx.strokeStyle='#f3d7ff';ctx.lineWidth=1;ctx.stroke();}
  }else{
    ctx.beginPath();ctx.arc(0,0,13,0,7);ctx.fill();ctx.scale(1,.5);ring(ctx,0,0,28,c,2);ctx.scale(1,2);for(let i=0;i<4;i++)star(ctx,Math.cos(p*8+i*1.6)*27,Math.sin(p*8+i*1.6)*24,6);
  }
  if(contact){ctx.globalAlpha=.5;ctx.lineWidth=2;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-55,i*9);ctx.lineTo(-24,i*11);ctx.stroke();}}
  if(spread){ctx.globalAlpha=.35;ring(ctx,0,0,34,c);}
}
function impact(ctx,a,p,type,strength=1){
  ctx.save();const c=PALETTE[type];glow(ctx,c);ctx.globalAlpha=(1-p)*strength;
  ring(ctx,a.x,a.y,12+ease(p)*52,c,4*(1-p)+1);
  if(['Steel','Gale','Shadow','Bloom'].includes(type)){
    ctx.lineWidth=5*(1-p)+1;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(a.x-28+i*14,a.y+30);ctx.quadraticCurveTo(a.x+i*14,a.y,a.x+17+i*14,a.y-30);ctx.stroke();}
  }
  for(let i=0;i<14;i++){
    const angle=i*2.399,dist=12+ease(p)*(28+(i%4)*12),x=a.x+Math.cos(angle)*dist,y=a.y+Math.sin(angle)*dist+p*p*12;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle+p*2);const r=(1-p)*(3+i%4);
    if(type==='Frost'||type==='Steel'){ctx.beginPath();ctx.moveTo(-r*2,0);ctx.lineTo(0,-r);ctx.lineTo(r*2,0);ctx.lineTo(0,r);ctx.closePath();ctx.fill();}
    else if(type==='Light'||type==='Astral'||type==='Volt')star(ctx,0,0,r*1.7);
    else if(type==='Stone')ctx.fillRect(-r,-r,r*2,r*2);
    else{ctx.beginPath();ctx.ellipse(0,0,r*1.6,r,0,0,7);ctx.fill();}
    ctx.restore();
  }
  ctx.restore();
}
function aura(ctx,a,p,type,kind){
  ctx.save();glow(ctx,PALETTE[type]);ctx.globalAlpha=Math.sin(p*Math.PI)*.85;
  if(kind==='guard'){
    ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x,a.y-48);ctx.lineTo(a.x+37,a.y-28);ctx.lineTo(a.x+29,a.y+22);ctx.quadraticCurveTo(a.x,a.y+60,a.x-29,a.y+22);ctx.lineTo(a.x-37,a.y-28);ctx.closePath();ctx.stroke();ctx.globalAlpha*=.2;ctx.fill();
  }else{
    ctx.save();ctx.translate(a.x,a.y+25);ctx.scale(1,.36);ring(ctx,0,0,25+p*42,PALETTE[type],4);ctx.restore();
    for(let i=0;i<8;i++){const x=a.x+Math.sin(i*4.7)*35,y=a.y+30-((p+i/8)%1)*95;star(ctx,x,y,kind==='boost'?7:5);}
  }
  ctx.restore();
}
function floating(ctx,a,p,text,sub,color){
  ctx.save();ctx.shadowColor='#071220';ctx.shadowBlur=6;ctx.globalAlpha=Math.min(1,p*8,Math.max(0,(1-p)*5));ctx.textAlign='center';
  const x=Math.max(55,Math.min(ctx.canvas.width/(Math.min(devicePixelRatio||1,2))-55,a.x)),y=Math.max(60,a.y-23-ease(p)*35);
  ctx.font='800 25px "DM Sans", sans-serif';ctx.fillStyle=color;ctx.lineWidth=4;ctx.strokeStyle='#101929';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);
  if(sub){ctx.font='700 10px "DM Sans", sans-serif';ctx.fillStyle=color;ctx.fillText(sub,x,y+19);}
  ctx.restore();
}
