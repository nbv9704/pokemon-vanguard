import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup,applyAction,validateAction} from '../src/logic.js';

const owner='animation-tests';
function fixture(mode='double'){
  const s=applyAction(setup([owner]),owner,{type:'battle',mode});
  for(const side of ['allies','enemies'])for(const m of s.battle[side]){m.max=5000;m.hp=5000;m.item=0;}
  return s;
}
function turn(s,moves=[0,0]){
  const commands=s.battle.allies.map((m,i)=>({m,i})).filter(x=>x.m.slot>=0&&x.m.hp>0).map((x,k)=>({kind:'move',actor:x.i,move:moves[k],target:0}));
  const a={type:'turn',round:s.battle.round,commands};
  assert.equal(validateAction(s,owner,a).ok,true);
  return applyAction(s,owner,a);
}
test('animation frames preserve exact target identity and intermediate HP for double spread attacks',()=>{
  const s=fixture();s.battle.enemies[0].id=6;s.battle.enemies[1].id=6;
  const original=JSON.stringify(s);const next=turn(s,[3,0]);assert.equal(JSON.stringify(s),original);
  const spread=next.battle.events.find(e=>e.kind==='move'&&e.side==='allies'&&e.actor===0);
  assert.equal(spread.move.effect,'spread');assert.deepEqual(spread.targets.map(t=>t.index),[0,1]);
  let prior=s.battle;
  for(const event of next.battle.events){
    for(const t of event.targets||[]){assert.equal(prior[t.side][t.index].hp-event.frame[t.side][t.index].hp,t.damage);}
    prior=event.frame;
  }
  assert.equal(next.battle.eventsRound,1);assert.equal(next.battle.round,2);
  assert.deepEqual(turn(s,[3,0]),next);
  const retained=JSON.stringify(next.battle.events[0].frame);next.battle.allies[0].hp=1;
  assert.equal(JSON.stringify(next.battle.events[0].frame),retained);
});
test('all twelve elements provide typed animation events',()=>{
  for(let type=0;type<12;type++){
    const s=fixture('single');s.battle.allies[0].id=type*3;
    const next=turn(s,[0]);const event=next.battle.events.find(e=>e.kind==='move'&&e.side==='allies');
    assert.ok(event.move.type);assert.equal(event.targets.length,1);assert.equal(event.frame.allies[0].id,type*3);
  }
});
test('guard, healing, weather and immunity report honest animation results',()=>{
  let s=fixture('single');s.battle.allies[0].id=22;
  let next=turn(s,[2]);assert.equal(next.battle.events[0].move.effect,'guard');
  assert.equal(next.battle.events.find(e=>e.side==='enemies'&&e.kind==='move').targets[0].blocked,true);
  s=fixture('single');s.battle.allies[0].id=18;s.battle.allies[0].hp=100;
  next=turn(s,[2]);const heal=next.battle.events.find(e=>e.side==='allies'&&e.kind==='move');assert.equal(heal.healing,1750);
  s=fixture('single');next=turn(s,[2]);const weather=next.battle.events.find(e=>e.side==='allies'&&e.kind==='move');assert.equal(weather.frame.weather,'Sun');
  s=fixture('single');s.battle.allies[0].id=9;s.battle.enemies[0].id=15;
  next=turn(s,[0]);const immune=next.battle.events.find(e=>e.side==='allies'&&e.kind==='move').targets[0];assert.equal(immune.effectiveness,0);assert.equal(immune.damage,0);
});
test('switch events precede damage; fainted actors do not animate a move',()=>{
  let s=fixture();const a={type:'turn',round:1,commands:[{kind:'switch',actor:0,to:2},{kind:'move',actor:1,move:0,target:0}]};
  let next=applyAction(s,owner,a);assert.equal(next.battle.events[0].kind,'switch');assert.equal(next.battle.events[0].incoming,2);assert.equal(next.battle.events[0].frame.allies[0].slot,-1);
  s=fixture('single');s.battle.enemies[0].hp=1;s.battle.enemies[0].id=6;s.battle.allies[0].level=100;
  next=turn(s,[0]);assert.ok(next.battle.events.some(e=>e.targets?.some(t=>t.fainted)));
  assert.ok(!next.battle.events.some(e=>e.kind==='move'&&e.side==='enemies'&&e.actor===0));
  assert.ok(next.battle.events.some(e=>e.kind==='entry'&&e.side==='enemies'));
});
test('legacy saved battles without presentation events resolve normally',()=>{
  const s=fixture('single');delete s.battle.events;delete s.battle.id;delete s.battleSerial;
  const next=turn(s,[0]);assert.ok(next.battle.events.length>0);assert.equal(next.battle.round,2);
});
