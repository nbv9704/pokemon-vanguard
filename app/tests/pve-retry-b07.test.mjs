import test from 'node:test';
import assert from 'node:assert/strict';
import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BetaProgression} from '../server/v3-progression.mjs';
import {applyV3BattlePlayerAction} from '../server/v3-battle-player-actions.mjs';
import {commitReceiptCommand} from '../server/receipt-command-handler.mjs';
import {CommercePendingActions} from '../public/js/commerce-pending-actions.js';

const initial=()=>({schemaVersion:3,owner:'test-pve',revision:1,seed:1234,wallet:{coins:1000,crystals:0,recruitmentTickets:0},progressionV3:createV3BetaProgression(v3Catalog)});
const apply=(s,a)=>applyV3BattlePlayerAction(s,a,v3Catalog,{now:1_800_000_000_000});
const start=s=>{let r=apply(s,{type:'battleV3.preview.start',mode:'single',actionId:'pve:start'});assert.equal(r.ok,true,r.code);s=r.state;const buildIds=s.battleV3.playerRoster.slice(0,3).map(p=>p.buildId);r=apply(s,{type:'battleV3.preview.lock',buildIds,actionId:'pve:lock'});assert.equal(r.ok,true,r.code);return r.state;};
const command=s=>{const battle=s.battleV3.battle;return {type:'battleV3.commands',phaseRevision:battle.phaseRevision,actionId:'pve:turn-one',commands:battle.sides.A.active.map((actorId,index)=>{const unit=battle.sides.A.roster.find(u=>u.actorId===actorId),move=unit.buildSnapshot.moveIds.map(id=>v3Catalog.movesById[id]).find(m=>!m.mechanics.handlers.some(h=>h.id==='apply-pivot-switch'));return {kind:'move',actorId,moveId:move.id,...(['self','userSide','field'].includes(move.mechanics.targetMode)?{}:{target:{side:'B',slot:index}})};})};};

test('PvE battle command retries do not resolve a turn twice or duplicate mission/ledger entries',()=>{
 const s=start(initial()),action=command(s),snapshot=structuredClone(s),first=apply(s,action);assert.equal(first.ok,true,first.code);assert.deepEqual(s,snapshot);
 const second=apply(first.state,action);assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.deepEqual(second.state,first.state);
 assert.equal(apply(first.state,{...action,commands:[]}).code,'ACTION_ID_REUSED');
 assert.equal(apply(first.state,{...action,actionId:'bad id'}).code,'INVALID_BATTLE_ACTION_ID');
 assert.equal(first.state.actionReceipts.filter(r=>r.actionId===action.actionId).length,1);
});

test('commit-after-write then lost ACK is recovered from authoritative save on retry',async()=>{
 let durable=start(initial()),live=structuredClone(durable),attempts=0,action=command(durable);
 const options={accountId:'a',liveState:live,load:async()=>structuredClone(durable),persist:async(_id,s)=>{durable=structuredClone(s);attempts++;if(attempts===1)throw Error('ACK_LOST');},action,apply};
 await assert.rejects(commitReceiptCommand(options),/ACK_LOST/);
 assert.equal(live.battleV3.battle.phaseRevision,command(live).phaseRevision);
 const recovered=await commitReceiptCommand(options);assert.equal(recovered.ok,true);assert.equal(recovered.duplicate,true);assert.deepEqual(recovered.state,durable);assert.equal(attempts,1);
});

test('PvE actions share the explicit retry outbox but cannot replace a pending shop purchase',()=>{
 const storage=new Map(),bridge={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},outbox=new CommercePendingActions({storage:bridge,scope:'b07'});
 const action={type:'battleV3.commands',phaseRevision:1,commands:[{kind:'move',actorId:'A-0',moveId:'protect'}],actionId:'pve:pending'};
 assert.equal(outbox.begin(action),true);assert.equal(outbox.begin({type:'shopV3.buy',itemId:'charcoal',actionId:'shop:new'}),false);
 assert.deepEqual(new CommercePendingActions({storage:bridge,scope:'b07'}).pending,action);
 assert.equal(outbox.acknowledge('another'),false);assert.equal(outbox.acknowledge(action.actionId),true);assert.equal(outbox.pending,null);
});
