import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applySwitch} from '../rules-v3/lifecycle.mjs';
import {createHookRegistry,createMoveActionHandler,HANDLER_DEFINITIONS,majorStatusEndTurnGroup,majorStatusTurnOptions,resolveMajorStatusEndTurn,speedWithMajorStatus,tryMajorStatusAction} from '../mechanics-v3/index.mjs';

const manifests=JSON.parse(await readFile(new URL('../content-src/mechanics-v3-manifests.json',import.meta.url),'utf8')).moves;
const specs={
 glare:{accuracy:100,status:'paralysis'},
 'poison-powder':{accuracy:75,status:'poison'},
 'stun-spore':{accuracy:75,status:'paralysis'},
 'thunder-wave':{accuracy:90,status:'paralysis'},
 'will-o-wisp':{accuracy:85,status:'burn'}
};
const moves=Object.fromEntries(Object.entries(specs).map(([id,spec])=>[id,{id,type:'normal',category:'status',power:null,accuracy:spec.accuracy}]));
const pp=()=>Object.fromEntries(Object.keys(specs).map(id=>[id,20]));
const unit=(actorId,types=['normal'])=>({actorId,types,hp:160,maxHp:160,stats:{hp:160,atk:100,def:100,spa:100,spd:100,spe:100},pp:pp(),status:null,volatiles:{},stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0}});
function fixture(format='single'){
 const activeCount=format==='single'?1:2,a=[unit('a1'),unit('a2')],b=[unit('b1'),unit('b2')];
 return {id:`status-${format}`,format,level:50,phase:'RESOLVE',phaseRevision:1,turn:1,eventSequence:0,events:[],result:null,activeCount,sides:{A:{active:a.slice(0,activeCount).map(entry=>entry.actorId),roster:a},B:{active:b.slice(0,activeCount).map(entry=>entry.actorId),roster:b}}};
}
const resolveMove=createMoveActionHandler({moves,manifests,registry:createHookRegistry(HANDLER_DEFINITIONS)});
const action=moveId=>({kind:'move',side:'A',actorId:'a1',moveId,target:{side:'B',slot:0}});

test('r3-major-status:single applies each reviewed status after a seeded accuracy hit',()=>{
 for(const [moveId,spec] of Object.entries(specs)){
  const battle=fixture(),before=JSON.stringify(battle),result=resolveMove(battle,action(moveId),{nextRandom:()=>0});
  assert.equal(JSON.stringify(battle),before,moveId);assert.equal(result.battle.sides.B.roster[0].status.id,spec.status,moveId);
  assert.equal(result.events.at(-1).kind,'statusApplied',moveId);assert.equal(result.battle.sides.A.roster[0].pp[moveId],19,moveId);
 }
});

test('major status respects intrinsic, move-specific and existing-status blocks',()=>{
 const cases=[
  ['will-o-wisp',['fire']],['glare',['electric']],['poison-powder',['poison']],['poison-powder',['steel']],
  ['poison-powder',['grass']],['stun-spore',['grass']],['stun-spore',['electric']],['thunder-wave',['ground']],['thunder-wave',['electric']]
 ];
 for(const [moveId,types] of cases){const battle=fixture();battle.sides.B.roster[0].types=types;const result=resolveMove(battle,action(moveId),{nextRandom:()=>0});assert.equal(result.events.at(-1).reason,'typeImmune',`${moveId}:${types}`);assert.equal(result.battle.sides.B.roster[0].status,null);}
 const occupied=fixture();occupied.sides.B.roster[0].status={id:'burn'};const result=resolveMove(occupied,action('glare'),{nextRandom:()=>0});
 assert.equal(result.events.at(-1).reason,'alreadyStatus');assert.equal(result.battle.sides.B.roster[0].status.id,'burn');
});

test('r3-major-status:double follows redirection and accuracy misses do not apply status',()=>{
 const redirected=fixture('double');redirected.sides.B.roster[1].volatiles.redirection={active:true,order:1};
 const hit=resolveMove(redirected,action('will-o-wisp'),{nextRandom:()=>0});assert.equal(hit.battle.sides.B.roster[0].status,null);assert.equal(hit.battle.sides.B.roster[1].status.id,'burn');
 const missed=resolveMove(fixture('double'),action('will-o-wisp'),{nextRandom:()=>.99});assert.equal(missed.events.at(-1).kind,'moveMissed');assert.equal(missed.battle.sides.B.roster[0].status,null);
});

test('burn and poison residuals resolve as one deterministic end-turn group',()=>{
 const battle=fixture('double');battle.phase='END_TURN';battle.sides.A.roster[0].status={id:'burn'};battle.sides.B.roster[0].status={id:'poison'};
 const group=majorStatusEndTurnGroup(battle);assert.deepEqual(group.changes,[{actorId:'a1',delta:-10},{actorId:'b1',delta:-20}]);
 const result=resolveMajorStatusEndTurn(battle);assert.equal(result.ok,true);assert.equal(result.battle.sides.A.roster[0].hp,150);assert.equal(result.battle.sides.B.roster[0].hp,140);
 assert.deepEqual(result.events.filter(event=>event.kind==='damage').map(event=>event.source),['major-status-residual','major-status-residual']);
});

test('paralysis halves speed and uses the seeded 25 percent action gate',()=>{
 const battle=fixture(),unitRef=battle.sides.A.roster[0];unitRef.status={id:'paralysis'};
 assert.equal(speedWithMajorStatus(101,unitRef),50);assert.equal(speedWithMajorStatus(101,battle.sides.B.roster[0]),101);
 assert.equal(majorStatusTurnOptions().getSpeed(battle,{actorId:'a1',speed:101}),50);
 const stopped=tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>.249});assert.equal(stopped.cancelled,true);assert.equal(stopped.events[0].kind,'actionPrevented');
 assert.equal(tryMajorStatusAction(battle,{actorId:'a1'},{nextRandom:()=>.25}).cancelled,false);
 const ppBefore=unitRef.pp.glare,moveResult=resolveMove(battle,action('glare'),{nextRandom:()=>.1});assert.deepEqual(moveResult.events,[{kind:'actionPrevented',actorId:'a1',status:'paralysis'}]);assert.equal(moveResult.battle.sides.A.roster[0].pp.glare,ppBefore);
});

test('switching preserves major status and clears all seven battle stages',()=>{
 const battle=fixture();battle.sides.A.roster[0].status={id:'poison'};battle.sides.A.roster[0].stages={atk:2,def:-1,spa:1,spd:0,spe:-2,accuracy:3,evasion:4};
 const result=applySwitch(battle,'A','a1','a2');assert.equal(result.ok,true);assert.equal(result.battle.sides.A.roster[0].status.id,'poison');
 assert.deepEqual(result.battle.sides.A.roster[0].stages,{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0});
});
