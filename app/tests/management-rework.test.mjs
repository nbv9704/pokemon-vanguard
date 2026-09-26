import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createLocalServer} from '../local-server.mjs';
import {publicV3Catalog,v3Catalog} from '../server/v3-catalog.mjs';
import {applyV3ProgressionAction,createV3BetaProgression,v3TrainingCost,v3TrainingView} from '../server/v3-progression.mjs';
import {analyzeReplica,decodeReplicaTeam,encodeReplicaTeam,replicaFromTeam} from '../public/js/replica-teams.js';
import {V3TeamBuilder} from '../public/js/v3-team-builder.js';

async function localClient(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/test`),pending=[],frames=[];
 ws.on('message',raw=>{const message=JSON.parse(raw),index=pending.findIndex(entry=>entry.predicate(message));if(index>=0){const entry=pending.splice(index,1)[0];clearTimeout(entry.timer);entry.resolve(message);}else frames.push(message);});
 const next=(predicate=()=>true)=>{const index=frames.findIndex(predicate);if(index>=0)return Promise.resolve(frames.splice(index,1)[0]);return new Promise((resolve,reject)=>{const entry={predicate,resolve,timer:setTimeout(()=>reject(Error('Frame timeout')),3000)};pending.push(entry);});};
 await new Promise(resolve=>ws.once('open',resolve));ws.send(JSON.stringify({type:'join',playerId:'management-rework'}));
 return {ws,initial:await next(message=>message.type==='state'),next,action:action=>ws.send(JSON.stringify({type:'action',action}))};
}

test('training cost charges each paid category and ignores held items',()=>{
 const progression=createV3BetaProgression(v3Catalog),current=progression.builds[0],candidate=structuredClone(current),species=v3Catalog.speciesById[progression.mons[0].speciesId];candidate.statPoints.hp++;candidate.statPoints.spa--;candidate.natureId=candidate.natureId==='adamant'?'modest':'adamant';candidate.abilityId=species.abilityIds.find(id=>id!==current.abilityId)||current.abilityId;candidate.moveIds[0]=species.moveIds.find(id=>!current.moveIds.includes(id))||current.moveIds[0];candidate.itemId=v3Catalog.items.find(item=>item.id!==current.itemId).id;const cost=v3TrainingCost(current,candidate);assert.equal(cost.statPoints,1);assert.equal(cost.nature,1);assert.equal(cost.moves,species.moveIds.some(id=>!current.moveIds.includes(id))?1:0);assert.equal(cost.total,5+500+cost.ability*500+cost.moves*250);
 const itemOnly={...structuredClone(current),itemId:candidate.itemId};assert.equal(v3TrainingCost(current,itemOnly).total,0);
});

test('Replica Team IDs round-trip and apply only to an eligible owned roster',()=>{
 const progression=createV3BetaProgression(v3Catalog),view=v3TrainingView(progression,v3Catalog),replica=replicaFromTeam(view),code=encodeReplicaTeam(replica),decoded=decodeReplicaTeam(code);assert.match(code,/^PV1\./);assert.deepEqual(decoded,replica);assert.equal(analyzeReplica(decoded,view,publicV3Catalog).legal,true);
 decoded.name='Shared Team';decoded.members.reverse();const result=applyV3ProgressionAction(progression,{type:'replicaV3.apply',expectedRevision:progression.revision,replica:decoded},v3Catalog);assert.equal(result.ok,true);assert.equal(result.team.name,'Shared Team');assert.deepEqual(result.team.buildIds.map(id=>result.progression.mons.find(mon=>mon.monId===result.progression.builds.find(build=>build.buildId===id).monId).speciesId),decoded.members.map(member=>member.speciesId));
 const blocked=structuredClone(decoded);blocked.members[0].speciesId='missing-species';assert.equal(applyV3ProgressionAction(progression,{type:'replicaV3.apply',expectedRevision:progression.revision,replica:blocked},v3Catalog).code,'REPLICA_POKEMON_NOT_OWNED');
});

test('Team Builder owns held-item selection and emits a build save',()=>{
 const progression=createV3BetaProgression(v3Catalog),state={trainingV3:v3TrainingView(progression,v3Catalog)},sent=[],builder=new V3TeamBuilder({onChange(){},sendAction:action=>sent.push(action),createActionId:()=> 'held-item:test'});let html=builder.render(state,publicV3Catalog);assert.match(html,/Held Items/);assert.match(html,/class="item-sprite /);assert.match(html,/--item-col:\d+;--item-row:\d+/);builder.handleClick({dataset:{v3Team:'items'}},state,publicV3Catalog);html=builder.render(state,publicV3Catalog);assert.match(html,/held-item-workspace/);assert.match(html,/class="item-sprite held-item-preview"/);assert.match(html,/Recent/);assert.match(html,/Effect Extend/);assert.match(html,/Berry/);assert.match(html,/Mega Stone/);assert.match(html,/Other/);assert.doesNotMatch(html,/<span>◆<\/span>/);const alternative=publicV3Catalog.items.find(item=>item.id==='quick-claw');builder.handleClick({dataset:{v3Team:'item',itemId:alternative.id}},state,publicV3Catalog);assert.equal(sent[0].type,'buildV3.save');assert.equal(sent[0].build.itemId,alternative.id);assert.equal(sent[0].actionId,'held-item:test');
});

test('the local server authoritatively charges training VP but keeps held-item changes free',async()=>{
 const saveDir=await mkdtemp(path.join(os.tmpdir(),'aether-training-cost-')),app=createLocalServer({saveDir,betaTestFunds:true});
 try{
  const port=await app.listen(0),connection=await localClient(port),before=connection.initial.view,build=structuredClone(before.trainingV3.builds[0]),from=Object.keys(build.statPoints).find(key=>build.statPoints[key]>0),to=Object.keys(build.statPoints).find(key=>key!==from&&build.statPoints[key]<32);
  build.statPoints[from]--;build.statPoints[to]++;
  connection.action({type:'buildV3.save',expectedRevision:build.revision,build,actionId:'training-cost:stat'});
  const trained=(await connection.next(message=>message.view?.trainingV3?.builds?.some(entry=>entry.buildId===build.buildId&&entry.revision===build.revision+1))).view;
  assert.equal(trained.coins,before.coins-5);
  const saved=structuredClone(trained.trainingV3.builds.find(entry=>entry.buildId===build.buildId)),alternative=publicV3Catalog.items.find(item=>item.id==='quick-claw');saved.itemId=alternative.id;
  connection.action({type:'buildV3.save',expectedRevision:saved.revision,build:saved,actionId:'training-cost:item'});
  const itemChanged=(await connection.next(message=>message.view?.trainingV3?.builds?.some(entry=>entry.buildId===saved.buildId&&entry.revision===saved.revision+1))).view;
  assert.equal(itemChanged.coins,trained.coins);connection.ws.close();
 }finally{await app.close();await rm(saveDir,{recursive:true,force:true});}
});
