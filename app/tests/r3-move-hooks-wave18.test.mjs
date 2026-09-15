import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySubstitute,compilePassiveEffects,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';
import {resolveActionQueue} from '../rules-v3/turn-engine.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const byId=Object.fromEntries(catalog.map(move=>[move.id,move]));
const priority={
 accelerock:{priority:1,contact:true},'aqua-jet':{priority:1,contact:true},'bullet-punch':{priority:1,contact:true,tags:['punch']},'extreme-speed':{priority:2,contact:true},
 'jet-punch':{priority:1,contact:true,tags:['punch']},'mach-punch':{priority:1,contact:true,tags:['punch']},'quick-attack':{priority:1,contact:true},'shadow-sneak':{priority:1,contact:true},'vacuum-wave':{priority:1,contact:false}
};
const direct={
 'aqua-tail':{targetMode:'adjacentFoe',contact:true},'aura-sphere':{targetMode:'anyAdjacent',contact:false,tags:['bullet','pulse']},boomburst:{targetMode:'allAdjacent',contact:false,tags:['sound']},
 'brutal-swing':{targetMode:'allAdjacent',contact:true},cut:{targetMode:'adjacentFoe',contact:true,tags:['slicing']},'dazzling-gleam':{targetMode:'allAdjacentFoes',contact:false},
 'dragon-claw':{targetMode:'adjacentFoe',contact:true,tags:['slicing']},'dragon-pulse':{targetMode:'anyAdjacent',contact:false,tags:['pulse']},'drill-peck':{targetMode:'anyAdjacent',contact:true},
 'high-horsepower':{targetMode:'adjacentFoe',contact:true},'hydro-pump':{targetMode:'adjacentFoe',contact:false},'mega-kick':{targetMode:'adjacentFoe',contact:true},megahorn:{targetMode:'adjacentFoe',contact:true},
 'petal-blizzard':{targetMode:'allAdjacent',contact:false},'power-gem':{targetMode:'adjacentFoe',contact:false},'power-whip':{targetMode:'adjacentFoe',contact:true},'seed-bomb':{targetMode:'adjacentFoe',contact:false,tags:['bullet']},
 'shadow-punch':{targetMode:'adjacentFoe',contact:true,tags:['punch']},'shock-wave':{targetMode:'adjacentFoe',contact:false},'smart-strike':{targetMode:'adjacentFoe',contact:true},'x-scissor':{targetMode:'adjacentFoe',contact:true,tags:['slicing']}
};
const stages={
 'dragon-dance':{targetMode:'self',boosts:{atk:1,spe:1}},'iron-defense':{targetMode:'self',boosts:{def:2}},'nasty-plot':{targetMode:'self',boosts:{spa:2}},
 'quiver-dance':{targetMode:'self',boosts:{spa:1,spd:1,spe:1}},'rock-polish':{targetMode:'self',boosts:{spe:2}},'shell-smash':{targetMode:'self',boosts:{def:-1,spd:-1,atk:2,spa:2,spe:2}},
 shelter:{targetMode:'self',boosts:{def:2}},'swords-dance':{targetMode:'self',boosts:{atk:2}},'eerie-impulse':{targetMode:'adjacentFoe',boosts:{spa:-2}},
 'metal-sound':{targetMode:'adjacentFoe',boosts:{spd:-2},tags:['sound']},'tearful-look':{targetMode:'adjacentFoe',boosts:{atk:-1,spa:-1},bypassesProtect:true},tickle:{targetMode:'adjacentFoe',boosts:{atk:-1,def:-1}}
};
const secondary={
 'acid-spray':{boosts:{spd:-2},chance:100,tags:['bullet']},'apple-acid':{boosts:{spd:-1},chance:100},'bitter-malice':{boosts:{atk:-1},chance:100},'breaking-swipe':{boosts:{atk:-1},chance:100,targetMode:'allAdjacentFoes',contact:true},
 'bug-buzz':{boosts:{spd:-1},chance:10,tags:['sound']},'chilling-water':{boosts:{atk:-1},chance:100},'crush-claw':{boosts:{def:-1},chance:50,contact:true,tags:['slicing']},'earth-power':{boosts:{spd:-1},chance:10},
 electroweb:{boosts:{spe:-1},chance:100,targetMode:'allAdjacentFoes'},'energy-ball':{boosts:{spd:-1},chance:10,tags:['bullet']},'fire-lash':{boosts:{def:-1},chance:100,contact:true},'flash-cannon':{boosts:{spd:-1},chance:10},
 'focus-blast':{boosts:{spd:-1},chance:10,tags:['bullet']},'iron-tail':{boosts:{def:-1},chance:30,contact:true},'low-sweep':{boosts:{spe:-1},chance:100,contact:true},'lumina-crash':{boosts:{spd:-2},chance:100},
 lunge:{boosts:{atk:-1},chance:100,contact:true},moonblast:{boosts:{spa:-1},chance:10},'mud-shot':{boosts:{spe:-1},chance:100},'mud-slap':{boosts:{accuracy:-1},chance:100},
 'muddy-water':{boosts:{accuracy:-1},chance:30,targetMode:'allAdjacentFoes'},'mystical-fire':{boosts:{spa:-1},chance:100},'night-daze':{boosts:{accuracy:-1},chance:40},'play-rough':{boosts:{atk:-1},chance:10,contact:true},
 pounce:{boosts:{spe:-1},chance:100,contact:true},psychic:{boosts:{spd:-1},chance:10},'razor-shell':{boosts:{def:-1},chance:50,contact:true,tags:['slicing']},'rock-smash':{boosts:{def:-1},chance:50,contact:true,tags:['punch']},
 'rock-tomb':{boosts:{spe:-1},chance:100},'shadow-ball':{boosts:{spd:-1},chance:20,tags:['bullet']},'skitter-smack':{boosts:{spa:-1},chance:100,contact:true},snarl:{boosts:{spa:-1},chance:100,targetMode:'allAdjacentFoes',tags:['sound']},
 'struggle-bug':{boosts:{spa:-1},chance:100,targetMode:'allAdjacentFoes'},'trop-kick':{boosts:{atk:-1},chance:100,contact:true}
};
const ids=[...Object.keys(priority),...Object.keys(direct),...Object.keys(stages),...Object.keys(secondary)];
const moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['water'],hp:900,maxHp:900,stats:{hp:900,atk:140,def:120,spa:140,spd:120,spe:100},pp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`wave18-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:17,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const runtime={nextRandom:()=>0};
const setAbility=(battle,side,index,id)=>{battle.sides[side].roster[index].passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const stageValue=(battle,side,index,stat)=>battle.sides[side].roster[index].stages[stat]||0;

function expectedManifest(id,spec,kind){
 const m=manifests.moves[id];assert.ok(m,`${id}: manifest`);assert.equal(m.id,id);assert.equal(m.priority,spec.priority??0,`${id}: priority`);assert.equal(m.contact,spec.contact??false,`${id}: contact`);
 assert.equal(m.targetMode,spec.targetMode??'adjacentFoe',`${id}: targetMode`);assert.deepEqual(m.tags??[],spec.tags??[],`${id}: tags`);assert.deepEqual(m.testEvidence,{single:['r3-move-hooks-wave18:single'],double:['r3-move-hooks-wave18:double']},`${id}: evidence`);
 if(kind==='secondary')assert.deepEqual(m.secondaryEffects,[{kind:'stat-stages',chance:spec.chance,boosts:spec.boosts}],`${id}: secondary`);
}

test('r3-move-hooks-wave18:single all 76 promoted declarations match the source-audited family specs',()=>{
 assert.equal(ids.length,76);assert.equal(new Set(ids).size,76);
 for(const [id,spec] of Object.entries(priority))expectedManifest(id,spec,'damage');
 for(const [id,spec] of Object.entries(direct))expectedManifest(id,spec,'damage');
 for(const [id,spec] of Object.entries(stages)){expectedManifest(id,spec,'stages');assert.deepEqual(manifests.moves[id].handlers.at(-1).params.boosts,spec.boosts,id);if(spec.bypassesProtect)assert.equal(manifests.moves[id].bypassesProtect,true,id);}
 for(const [id,spec] of Object.entries(secondary))expectedManifest(id,spec,'secondary');
});

test('priority attacks beat a faster neutral-priority action through the authoritative turn queue',()=>{
 for(const [moveId,spec] of Object.entries(priority)){
  const battle=fixture(),actions=[{kind:'move',side:'A',actorId:'a1',moveId,priority:manifests.moves[moveId].priority,speed:1},{kind:'move',side:'B',actorId:'b1',moveId:'probe',priority:0,speed:999}];
  const seen=[],result=resolveActionQueue(battle,actions,{move:(state,queued)=>{seen.push(queued.actorId);return {battle:state,events:[]};}});
  assert.equal(result.ok,true,moveId);assert.equal(spec.priority>0,true,moveId);assert.equal(seen[0],'a1',moveId);
 }
});

test('straight damage and priority families all resolve through shared direct damage and PP spending',()=>{
 for(const moveId of [...Object.keys(priority),...Object.keys(direct)]){
  const spec=priority[moveId]??direct[moveId],battle=fixture(spec.targetMode?.startsWith('allAdjacent')?'double':'single'),before=battle.sides.A.roster[0].pp[moveId];
  const result=resolveMove(battle,action(moveId),runtime),damages=result.events.filter(e=>e.kind==='damage');
  assert.equal(result.battle.sides.A.roster[0].pp[moveId],before-1,`${moveId}: pp`);assert.ok(damages.length>0,`${moveId}: damage`);assert.ok(damages.some(e=>e.amount>0),`${moveId}: positive damage`);
  if(spec.targetMode==='allAdjacentFoes')assert.equal(damages.length,2,`${moveId}: foe spread`);
  if(spec.targetMode==='allAdjacent')assert.equal(damages.length,3,`${moveId}: all-adjacent spread`);
 }
});

test('r3-move-hooks-wave18:double any-adjacent and spread target modes preserve doubles targeting semantics',()=>{
 let battle=fixture('double'),result=resolveMove(battle,action('aura-sphere',{side:'A',slot:1}),runtime);assert.ok(result.battle.sides.A.roster[1].hp<900);assert.equal(result.battle.sides.B.roster[0].hp,900);
 battle=fixture('double');result=resolveMove(battle,action('dazzling-gleam'),runtime);assert.equal(result.events.filter(e=>e.kind==='damage').length,2);assert.equal(result.battle.sides.A.roster[1].hp,900);
 battle=fixture('double');result=resolveMove(battle,action('boomburst'),runtime);assert.equal(result.events.filter(e=>e.kind==='damage').length,3);assert.ok(result.battle.sides.A.roster[1].hp<900);
});

test('all primary stat-stage moves resolve through one stage pipeline including Magic Bounce reflection',()=>{
 for(const [moveId,spec] of Object.entries(stages)){
  const battle=fixture(),self=spec.targetMode==='self',result=resolveMove(battle,action(moveId,self?{side:'A',slot:0}:{side:'B',slot:0}),runtime),side=self?'A':'B',index=0;
  for(const [stat,delta] of Object.entries(spec.boosts))assert.equal(stageValue(result.battle,side,index,stat),delta,`${moveId}:${stat}`);
 }
 const bounced=fixture();setAbility(bounced,'B',0,'magic-bounce');const result=resolveMove(bounced,action('eerie-impulse'),runtime);assert.equal(stageValue(result.battle,'A',0,'spa'),-2);assert.equal(stageValue(result.battle,'B',0,'spa'),0);assert.ok(result.events.some(e=>e.kind==='moveReflected'&&e.moveId==='eerie-impulse'));
});

test('all damaging stat secondaries apply to damaged targets deterministically, including spread moves',()=>{
 for(const [moveId,spec] of Object.entries(secondary)){
  const spread=spec.targetMode==='allAdjacentFoes',battle=fixture(spread?'double':'single'),result=resolveMove(battle,action(moveId),runtime);
  assert.ok(result.events.some(e=>e.kind==='damage'&&e.amount>0),`${moveId}: damage`);
  for(const [stat,delta] of Object.entries(spec.boosts)){
   assert.equal(stageValue(result.battle,'B',0,stat),delta,`${moveId}:${stat}:b1`);
   if(spread)assert.equal(stageValue(result.battle,'B',1,stat),delta,`${moveId}:${stat}:b2`);
  }
 }
});

test('move tags from the promoted batch feed shared immunity and power-boost Ability hooks',()=>{
 let battle=fixture();setAbility(battle,'B',0,'bulletproof');let result=resolveMove(battle,action('aura-sphere'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,900);assert.ok(result.events.some(e=>e.kind==='moveBlocked'&&e.reason==='abilityImmune'&&e.abilityId==='bulletproof'));
 battle=fixture();setAbility(battle,'B',0,'soundproof');result=resolveMove(battle,action('bug-buzz'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,900);assert.equal(stageValue(result.battle,'B',0,'spd'),0);
 for(const [moveId,abilityId] of [['dragon-pulse','mega-launcher'],['x-scissor','sharpness'],['shadow-punch','iron-fist']]){
  const plain=resolveMove(fixture(),action(moveId),runtime).events.find(e=>e.kind==='damage').amount,boostedBattle=fixture();setAbility(boostedBattle,'A',0,abilityId);const boosted=resolveMove(boostedBattle,action(moveId),runtime).events.find(e=>e.kind==='damage').amount;assert.ok(boosted>plain,`${moveId}:${abilityId}`);
 }
});

test('sound-tagged promoted moves bypass Substitute while ordinary moves still hit the decoy',()=>{
 let battle=applySubstitute(fixture(),{actorId:'b1',moveId:'substitute'}).battle,behindHp=battle.sides.B.roster[0].hp,result=resolveMove(battle,action('boomburst'),runtime);assert.ok(result.battle.sides.B.roster[0].hp<behindHp);assert.ok(result.battle.sides.B.roster[0].volatiles.substitute);
 battle=applySubstitute(fixture(),{actorId:'b1',moveId:'substitute'}).battle;const originalHp=battle.sides.B.roster[0].hp;result=resolveMove(battle,action('aqua-tail'),runtime);assert.equal(result.battle.sides.B.roster[0].hp,originalHp);assert.ok(result.events.some(e=>e.kind==='substituteDamaged'));
 battle=applySubstitute(fixture(),{actorId:'b1',moveId:'substitute'}).battle;result=resolveMove(battle,action('metal-sound'),runtime);assert.equal(stageValue(result.battle,'B',0,'spd'),-2);
});

test('Sheer Force suppresses a guaranteed Wave 18 stat secondary while retaining its power boost',()=>{
 const plain=resolveMove(fixture(),action('acid-spray'),runtime),battle=fixture();setAbility(battle,'A',0,'sheer-force');const boosted=resolveMove(battle,action('acid-spray'),runtime),plainDamage=plain.events.find(e=>e.kind==='damage').amount,boostedDamage=boosted.events.find(e=>e.kind==='damage').amount;
 assert.ok(boostedDamage>plainDamage);assert.equal(stageValue(boosted.battle,'B',0,'spd'),0);assert.equal(stageValue(plain.battle,'B',0,'spd'),-2);assert.ok(boosted.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='sheer-force'));
});
