import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySubstitute,compilePassiveEffects,createHeldItemState,createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS} from '../mechanics-v3/index.mjs';
import {resolveActionQueue} from '../rules-v3/turn-engine.mjs';

const catalog=JSON.parse(await readFile(new URL('../content-candidates/pv-ma-2026-09-12-beta2/normalized/moves.json',import.meta.url),'utf8'));
const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8'));
const byId=Object.fromEntries(catalog.map(move=>[move.id,move]));

const statusMoves={
 discharge:{status:'paralysis',chance:30,targetMode:'allAdjacent'},'fire-blast':{status:'burn',chance:10},'fire-fang':{status:'burn',chance:10,contact:true,tags:['bite'],extraFlinch:10},'fire-punch':{status:'burn',chance:10,contact:true,tags:['punch']},flamethrower:{status:'burn',chance:10},'gunk-shot':{status:'poison',chance:30},'heat-wave':{status:'burn',chance:10,targetMode:'allAdjacentFoes'},'ice-beam':{status:'freeze',chance:10},inferno:{status:'burn',chance:100},'lava-plume':{status:'burn',chance:30,targetMode:'allAdjacent'},nuzzle:{status:'paralysis',chance:100,contact:true},'poison-fang':{status:'bad-poison',chance:50,contact:true,tags:['bite']},'poison-jab':{status:'poison',chance:30,contact:true},'sludge-bomb':{status:'poison',chance:30,tags:['bullet']},'sludge-wave':{status:'poison',chance:10,targetMode:'allAdjacent'},'thunder-fang':{status:'paralysis',chance:10,contact:true,tags:['bite'],extraFlinch:10},'thunder-punch':{status:'paralysis',chance:10,contact:true,tags:['punch']},'thunder-shock':{status:'paralysis',chance:10},thunderbolt:{status:'paralysis',chance:10},'zap-cannon':{status:'paralysis',chance:100,tags:['bullet']}
};
const flinchMoves={
 'air-slash':{chance:30,targetMode:'anyAdjacent',tags:['slicing']},astonish:{chance:30,contact:true},bite:{chance:30,contact:true,tags:['bite']},'dark-pulse':{chance:20,targetMode:'anyAdjacent',tags:['pulse']},'dragon-rush':{chance:20,contact:true},extrasensory:{chance:10},'icicle-crash':{chance:30},'iron-head':{chance:20,contact:true},'mountain-gale':{chance:30},'zen-headbutt':{chance:20,contact:true}
};
const multiHit={
 'bone-rush':{hits:[2,5]},'pin-missile':{hits:[2,5]},'tail-slap':{hits:[2,5],contact:true},'water-shuriken':{hits:[2,5],priority:1}
};
const selfDrops={
 'armor-cannon':{boosts:{def:-1,spd:-1}},'clanging-scales':{boosts:{def:-1},targetMode:'allAdjacentFoes',tags:['sound']},'close-combat':{boosts:{def:-1,spd:-1},contact:true},'draco-meteor':{boosts:{spa:-2}},'hammer-arm':{boosts:{spe:-1},contact:true,tags:['punch']},'headlong-rush':{boosts:{def:-1,spd:-1},contact:true},'ice-hammer':{boosts:{spe:-1},contact:true,tags:['punch']},'leaf-storm':{boosts:{spa:-2}},overheat:{boosts:{spa:-2}},superpower:{boosts:{atk:-1,def:-1},contact:true}
};
const selfBoosts={
 'ancient-power':{chance:10,boosts:{atk:1,def:1,spa:1,spd:1,spe:1}},'aqua-step':{chance:100,boosts:{spe:1},contact:true},'charge-beam':{chance:70,boosts:{spa:1}},'fiery-dance':{chance:50,boosts:{spa:1}},'flame-charge':{chance:100,boosts:{spe:1},contact:true},'meteor-mash':{chance:20,boosts:{atk:1},contact:true,tags:['punch']},'psyshield-bash':{chance:100,boosts:{def:1},contact:true},'steel-wing':{chance:10,boosts:{def:1},contact:true},'torch-song':{chance:100,boosts:{spa:1},tags:['sound']},trailblaze:{chance:100,boosts:{spe:1},contact:true}
};
const ids=[...Object.keys(statusMoves),...Object.keys(flinchMoves),...Object.keys(multiHit),'wave-crash',...Object.keys(selfDrops),...Object.keys(selfBoosts)];
const moves=Object.fromEntries(ids.map(id=>[id,byId[id]]));
const resolveMove=createMoveActionHandler({moves,manifests:manifests.moves,abilityManifests:manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const blankStages=()=>({atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
const pp=()=>Object.fromEntries(ids.map(id=>[id,Math.max(byId[id]?.maxPP||16,1)]));
const unit=(actorId,overrides={})=>({actorId,speciesId:actorId,types:['normal'],hp:1200,maxHp:1200,stats:{hp:1200,atk:160,def:130,spa:160,spd:130,spe:100},pp:pp(),maxPp:pp(),status:null,volatiles:{},stages:blankStages(),passiveEffects:[],abilityState:{},itemState:createHeldItemState(null),...overrides});
function fixture(format='single'){
 const n=format==='double'?2:1,a=[unit('a1'),unit('a2')],b=[unit('b1',{types:['water']}),unit('b2',{types:['water']})];
 return {id:`wave19-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,activeCount:n,rngState:19,eventSequence:0,events:[],result:null,field:{},sides:{A:{active:a.slice(0,n).map(x=>x.actorId),roster:a,conditions:{}},B:{active:b.slice(0,n).map(x=>x.actorId),roster:b,conditions:{}}}};
}
const action=(moveId,target={side:'B',slot:0})=>({kind:'move',side:'A',actorId:'a1',moveId,target,priority:manifests.moves[moveId].priority,speed:100});
const always=()=>0;
const setAbility=(battle,side,index,id)=>{battle.sides[side].roster[index].passiveEffects=compilePassiveEffects({abilityId:id,manifests});};
const stage=(battle,side,index,key)=>battle.sides[side].roster[index].stages[key]||0;

function expectBase(id,spec={}){
 const m=manifests.moves[id];assert.ok(m,`${id}: manifest`);assert.equal(m.targetMode,spec.targetMode??'adjacentFoe',`${id}: target`);assert.equal(m.priority,spec.priority??0,`${id}: priority`);assert.equal(m.contact,spec.contact??false,`${id}: contact`);assert.deepEqual(m.tags??[],spec.tags??[],`${id}: tags`);assert.deepEqual(m.testEvidence,{single:['r3-move-hooks-wave19:single'],double:['r3-move-hooks-wave19:double']},`${id}: evidence`);
}

test('r3-move-hooks-wave19:single all 55 promoted declarations match the source-audited family specs',()=>{
 assert.equal(ids.length,55);assert.equal(new Set(ids).size,55);
 for(const [id,spec] of Object.entries(statusMoves)){expectBase(id,spec);const effects=manifests.moves[id].secondaryEffects;assert.deepEqual(effects[0],{kind:'major-status',chance:spec.chance,status:spec.status},id);if(spec.extraFlinch)assert.deepEqual(effects[1],{kind:'volatile-status',chance:spec.extraFlinch,volatile:'flinch'},id);}
 for(const [id,spec] of Object.entries(flinchMoves)){expectBase(id,spec);assert.deepEqual(manifests.moves[id].secondaryEffects,[{kind:'volatile-status',chance:spec.chance,volatile:'flinch'}],id);}
 for(const [id,spec] of Object.entries(multiHit)){expectBase(id,spec);assert.deepEqual(manifests.moves[id].handlers.find(h=>h.id==='deal-multi-hit-damage')?.params?.hits,spec.hits,id);}
 expectBase('wave-crash',{contact:true});assert.deepEqual(manifests.moves['wave-crash'].handlers.find(h=>h.id==='apply-recoil')?.params,{numerator:33,denominator:100});
 for(const [id,spec] of Object.entries(selfDrops)){expectBase(id,spec);const h=manifests.moves[id].handlers.find(x=>x.id==='apply-stat-stages');assert.deepEqual(h?.params,{target:'self',requireDamage:true,boosts:spec.boosts},id);}
 for(const [id,spec] of Object.entries(selfBoosts)){expectBase(id,spec);assert.deepEqual(manifests.moves[id].secondaryEffects,[{kind:'stat-stages',chance:spec.chance,target:'self',boosts:spec.boosts}],id);}
});

test('every Wave 19 move executes its promoted runtime family at least once',()=>{
 for(const [id,spec] of Object.entries(statusMoves)){const result=resolveMove(fixture(spec.targetMode?.startsWith('allAdjacent')?'double':'single'),action(id),{nextRandom:always});assert.ok(result.events.some(e=>e.kind==='damage'&&e.amount>0),`${id}: damage`);assert.ok(result.events.some(e=>e.kind==='statusApplied'),`${id}: status`);if(spec.extraFlinch)assert.ok(result.events.some(e=>e.kind==='volatileApplied'&&e.volatile==='flinch'),`${id}: flinch`);}
 for(const id of Object.keys(flinchMoves)){const result=resolveMove(fixture(),action(id),{nextRandom:always});assert.ok(result.events.some(e=>e.kind==='damage'&&e.amount>0),`${id}: damage`);assert.equal(result.battle.sides.B.roster[0].volatiles.flinch?.id,'flinch',`${id}: flinch`);}
 for(const id of Object.keys(multiHit)){const result=resolveMove(fixture(),action(id),{nextRandom:always});const hit=result.events.find(e=>e.kind==='hitCount');assert.ok(hit,`${id}: hit count`);assert.ok(hit.hitCount>=2&&hit.hitCount<=5,`${id}: hit range`);}
 {const result=resolveMove(fixture(),action('wave-crash'),{nextRandom:always});assert.ok(result.battle.sides.A.roster[0].hp<1200);}
 for(const [id,spec] of Object.entries(selfDrops)){const result=resolveMove(fixture(spec.targetMode==='allAdjacentFoes'?'double':'single'),action(id),{nextRandom:always});for(const [key,value] of Object.entries(spec.boosts))assert.equal(stage(result.battle,'A',0,key),value,`${id}:${key}`);}
 for(const [id,spec] of Object.entries(selfBoosts)){const result=resolveMove(fixture(),action(id),{nextRandom:always});for(const [key,value] of Object.entries(spec.boosts))assert.equal(stage(result.battle,'A',0,key),value,`${id}:${key}`);}
});

test('r3-move-hooks-wave19:double all-adjacent status moves preserve ally/foe targeting semantics',()=>{
 let result=resolveMove(fixture('double'),action('discharge'),{nextRandom:always});assert.equal(result.events.filter(e=>e.kind==='damage').length,3);assert.equal(result.battle.sides.A.roster[1].status?.id,'paralysis');assert.equal(result.battle.sides.B.roster[0].status?.id,'paralysis');assert.equal(result.battle.sides.B.roster[1].status?.id,'paralysis');
 result=resolveMove(fixture('double'),action('heat-wave'),{nextRandom:always});assert.equal(result.events.filter(e=>e.kind==='damage').length,2);assert.equal(result.battle.sides.A.roster[1].status,null);assert.equal(result.battle.sides.B.roster[0].status?.id,'burn');assert.equal(result.battle.sides.B.roster[1].status?.id,'burn');
});

test('major-status secondaries reuse intrinsic immunity and Shield Dust suppression',()=>{
 let battle=fixture();battle.sides.B.roster[0].types=['electric'];let result=resolveMove(battle,action('thunderbolt'),{nextRandom:always});assert.equal(result.battle.sides.B.roster[0].status,null);assert.ok(result.events.some(e=>e.kind==='statusFailed'&&e.reason==='typeImmune'));
 battle=fixture();setAbility(battle,'B',0,'shield-dust');result=resolveMove(battle,action('fire-fang'),{nextRandom:always});assert.equal(result.battle.sides.B.roster[0].status,null);assert.equal(result.battle.sides.B.roster[0].volatiles.flinch,undefined);assert.ok(result.events.some(e=>e.kind==='secondaryEffectBlocked'));
});

test('multihit uses seeded hit counts, Skill Link forces five, and Water Shuriken keeps priority',()=>{
 let result=resolveMove(fixture(),action('bone-rush'),{nextRandom:()=>0});assert.equal(result.events.find(e=>e.kind==='hitCount')?.plannedHits,2);
 const battle=fixture();setAbility(battle,'A',0,'skill-link');result=resolveMove(battle,action('pin-missile'),{nextRandom:()=>0.5});assert.equal(result.events.find(e=>e.kind==='hitCount')?.plannedHits,5);assert.equal(result.events.find(e=>e.kind==='hitCount')?.hitCount,5);
 assert.equal(manifests.moves['water-shuriken'].priority,1);const seen=[];resolveActionQueue(fixture(),[{...action('water-shuriken'),speed:1},{kind:'move',side:'B',actorId:'b1',moveId:'probe',priority:0,speed:999}],{move:(state,a)=>{seen.push(a.actorId);return {battle:state,events:[]};}});assert.equal(seen[0],'a1');
});

test('Wave Crash recoil uses shared recoil handling and Magic Guard blocks only the recoil',()=>{
 const plain=resolveMove(fixture(),action('wave-crash'),{nextRandom:always});assert.ok(plain.battle.sides.B.roster[0].hp<1200);assert.ok(plain.battle.sides.A.roster[0].hp<1200);assert.ok(plain.events.some(e=>e.kind==='damage'&&e.source==='recoil'));
 const battle=fixture();setAbility(battle,'A',0,'magic-guard');const guarded=resolveMove(battle,action('wave-crash'),{nextRandom:always});assert.ok(guarded.battle.sides.B.roster[0].hp<1200);assert.equal(guarded.battle.sides.A.roster[0].hp,1200);assert.ok(guarded.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='magic-guard'));
});

test('primary self drops require successful damage and still run Contrary/White Herb lifecycle',()=>{
 let battle=fixture();battle.sides.B.roster[0].types=['ghost'];let result=resolveMove(battle,action('close-combat'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.def,0);assert.equal(result.battle.sides.A.roster[0].stages.spd,0);
 battle=fixture();setAbility(battle,'A',0,'contrary');result=resolveMove(battle,action('close-combat'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.def,1);assert.equal(result.battle.sides.A.roster[0].stages.spd,1);
 battle=fixture();battle.sides.A.roster[0].itemState=createHeldItemState('white-herb');battle.sides.A.roster[0].passiveEffects=compilePassiveEffects({itemId:'white-herb',manifests});result=resolveMove(battle,action('close-combat'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.def,0);assert.equal(result.battle.sides.A.roster[0].stages.spd,0);assert.equal(result.battle.sides.A.roster[0].itemState.consumed,true);
});

test('self secondaries are once-per-user, ignore target Shield Dust, and Sheer Force suppresses them while boosting damage',()=>{
 let battle=fixture();setAbility(battle,'B',0,'shield-dust');let result=resolveMove(battle,action('torch-song'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.spa,1);assert.ok(result.battle.sides.B.roster[0].hp<1200);
 const plainDamage=result.events.find(e=>e.kind==='damage').amount;battle=fixture();setAbility(battle,'A',0,'sheer-force');result=resolveMove(battle,action('torch-song'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.spa,0);assert.ok(result.events.find(e=>e.kind==='damage').amount>plainDamage);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='sheer-force'));
 battle=fixture();setAbility(battle,'A',0,'sheer-force');result=resolveMove(battle,action('close-combat'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.def,-1);assert.equal(result.battle.sides.A.roster[0].stages.spd,-1);
});

test('self secondaries flow through Contrary and Opportunist stage-response logic',()=>{
 let battle=fixture();setAbility(battle,'A',0,'contrary');let result=resolveMove(battle,action('flame-charge'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.spe,-1);
 battle=fixture();setAbility(battle,'B',0,'opportunist');result=resolveMove(battle,action('flame-charge'),{nextRandom:always});assert.equal(result.battle.sides.A.roster[0].stages.spe,1);assert.equal(result.battle.sides.B.roster[0].stages.spe,1);assert.ok(result.events.some(e=>e.kind==='abilityTriggered'&&e.abilityId==='opportunist'));
});

test('Wave 19 tags reuse Bulletproof, Soundproof, Mega Launcher, Sharpness, Iron Fist, and Strong Jaw hooks',()=>{
 for(const [moveId,abilityId] of [['dark-pulse','mega-launcher'],['air-slash','sharpness'],['fire-punch','iron-fist'],['poison-fang','strong-jaw']]){const plain=resolveMove(fixture(),action(moveId),{nextRandom:always}).events.find(e=>e.kind==='damage').amount,battle=fixture();setAbility(battle,'A',0,abilityId);const boosted=resolveMove(battle,action(moveId),{nextRandom:always}).events.find(e=>e.kind==='damage').amount;assert.ok(boosted>plain,`${moveId}:${abilityId}`);}
 let battle=fixture();setAbility(battle,'B',0,'bulletproof');let result=resolveMove(battle,action('sludge-bomb'),{nextRandom:always});assert.equal(result.battle.sides.B.roster[0].hp,1200);assert.equal(result.battle.sides.B.roster[0].status,null);
 battle=fixture();setAbility(battle,'B',0,'soundproof');result=resolveMove(battle,action('torch-song'),{nextRandom:always});assert.equal(result.battle.sides.B.roster[0].hp,1200);assert.equal(result.battle.sides.A.roster[0].stages.spa,0);
});

test('sound-tagged self-effect attacks bypass Substitute while preserving their user-side effect',()=>{
 let battle=applySubstitute(fixture(),{actorId:'b1',moveId:'substitute'}).battle;const behind=battle.sides.B.roster[0].hp;let result=resolveMove(battle,action('torch-song'),{nextRandom:always});assert.ok(result.battle.sides.B.roster[0].hp<behind);assert.ok(result.battle.sides.B.roster[0].volatiles.substitute);assert.equal(result.battle.sides.A.roster[0].stages.spa,1);
 battle=applySubstitute(fixture('double'),{actorId:'b1',moveId:'substitute'}).battle;result=resolveMove(battle,action('clanging-scales'),{nextRandom:always});assert.ok(result.battle.sides.B.roster[0].hp<900);assert.equal(result.battle.sides.A.roster[0].stages.def,-1);
});
