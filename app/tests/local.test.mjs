import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createLocalServer } from '../local-server.mjs';

async function client(port, player='local-player') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/test`);
  const pending=[], frames=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);const i=pending.findIndex(p=>p.predicate(m));if(i>=0){const p=pending.splice(i,1)[0];clearTimeout(p.timer);p.resolve(m);}else frames.push(m);});
  const next=(predicate=()=>true)=>{const i=frames.findIndex(predicate);if(i>=0)return Promise.resolve(frames.splice(i,1)[0]);return new Promise((resolve,reject)=>{const entry={predicate,resolve,timer:setTimeout(()=>reject(Error('Frame timeout')),3000)};pending.push(entry);});};
  await new Promise(resolve=>ws.once('open',resolve));
  ws.send(JSON.stringify({type:'join',playerId:player}));
  const initial=await next(m=>m.type==='state');
  return {ws,initial,next,action:a=>ws.send(JSON.stringify({type:'action',action:a}))};
}
test('local HTTP, saved rewards, reload after server restart, spectator protection and battles',async()=>{
  const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-local-'));
  let app=createLocalServer({saveDir});
  try {
    let port=await app.listen(0);
    const response=await fetch(`http://127.0.0.1:${port}/`);assert.equal(response.status,200);assert.match(await response.text(),/Aether Champions/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/src/logic.js`)).status,404);
    const a=await client(port);assert.equal(a.initial.view.catalog.length,36);
    a.action({type:'claim',id:0});assert.equal((await a.next(m=>m.view?.gems===2300)).view.coins,2900);
    a.action({type:'claim',id:0});assert.match((await a.next(m=>m.type==='error')).error,/already claimed/);
    const spectator=await client(port,'spectator');assert.equal(spectator.initial.view.spectator,true);
    spectator.action({type:'summon',count:1});assert.match((await spectator.next(m=>m.type==='error')).error,/spectator/);
    await app.close();app=createLocalServer({saveDir});port=await app.listen(0);
    const b=await client(port);assert.equal(b.initial.view.gems,2300);
    b.action({type:'summon',count:10});const pulled=await b.next(m=>m.view?.summons===10);assert.equal(pulled.view.reveal.length,10);assert.equal(pulled.view.gems,1300);
    for(const mode of ['single','double']) {
      b.action({type:'battle',mode});let v=(await b.next(m=>m.view?.battle?.mode===mode&&!m.view.battle.result)).view;
      const commands=v.battle.allies.map((m,i)=>({m,i})).filter(x=>x.m.slot>=0).map(x=>({kind:'move',actor:x.i,move:0,target:0}));
      b.action({type:'turn',round:1,commands});assert.equal((await b.next(m=>m.view?.battle?.round===2)).view.battle.round,2);
      b.action({type:'surrender'});await b.next(m=>m.view?.battle?.result==='Surrendered');
    }
  } finally {await app.close();await rm(saveDir,{recursive:true,force:true});}
});
