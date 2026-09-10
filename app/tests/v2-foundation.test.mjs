import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/logic.js',import.meta.url),'utf8');
const names=['V2_validateBuild','V2_calculateStats','V2_createBattleMon','V2_effectiveness','V2_stageMultiplier','V2_calculateDamage','V2_spendPp','V2_allMovesEmpty','V2_nextRandom','V2_accuracyCheck','V2_moveGate','V2_struggleRecoil','V2_STRUGGLE'];
const engine=await import('data:text/javascript;base64,'+Buffer.from(source+`\nexport {${names.join(',')}};`).toString('base64'));

const species={id:'emberlyn',types:['Flame'],baseStats:{hp:70,atk:105,def:65,spa:55,spd:70,spe:115},moveIds:['flame-strike','gale-lance','guard','sun-call'],abilityIds:['dawnbringer','quick-start']};
const catalog={moveIds:[...species.moveIds],abilityIds:[...species.abilityIds],itemIds:['none','swift-feather']};
const validBuild={buildId:'b1',monId:'m1',points:{hp:0,atk:16,def:0,spa:0,spd:0,spe:16},alignment:{up:'spe',down:'spa'},abilityId:'dawnbringer',moveIds:[...species.moveIds],itemId:'none',revision:1};
const moves={'flame-strike':{maxPP:20},'gale-lance':{maxPP:10},guard:{maxPP:10},'sun-call':{maxPP:5}};

test('v2 validates builds, calculates six stats and snapshots battle units',()=>{
 assert.deepEqual(engine.V2_validateBuild(validBuild,species,catalog),[]);
 const stats=engine.V2_calculateStats(species.baseStats,validBuild.points,validBuild.alignment);
 assert.deepEqual(stats,{hp:170,atk:157,def:85,spa:67,spd:90,spe:183});
 const mon=engine.V2_createBattleMon({battleMonId:'A-0',ownerSide:'A',build:validBuild,species,moves,catalog});
 validBuild.points.atk=0;validBuild.moveIds[0]='changed';
 assert.equal(mon.stats.atk,157);assert.equal(mon.buildSnapshot.points.atk,16);assert.equal(mon.pp['flame-strike'],20);
});

test('v2 rejects point overflow, invalid alignment and illegal loadout',()=>{
 const build=JSON.parse(JSON.stringify(validBuild));build.points={hp:17,atk:16,def:1,spa:0,spd:0,spe:16};build.alignment={up:'hp',down:'hp'};build.moveIds=['flame-strike','flame-strike','unknown','guard'];build.abilityId='unknown';build.itemId='unknown';
 const errors=engine.V2_validateBuild(build,species,catalog).join('\n');
 assert.match(errors,/hp points/);assert.match(errors,/total/);assert.match(errors,/alignment/);assert.match(errors,/four different moves/);assert.match(errors,/ability/);assert.match(errors,/item/);
});

test('v2 damage matches golden values and single/dual type effectiveness',()=>{
 const attacker={types:['Flame'],stats:{atk:100,spa:100},stages:{},status:null},defender={types:['Gale'],stats:{def:100,spd:100},stages:{}};
 const move={type:'Flame',category:'physical',power:60};
 assert.equal(engine.V2_calculateDamage({move,attacker,defender}).damage,42);
 assert.equal(engine.V2_calculateDamage({move,attacker,defender:{...defender,types:['Bloom']}}).damage,84);
 assert.equal(engine.V2_effectiveness('Flame',['Bloom','Steel']),4);assert.equal(engine.V2_effectiveness('Bloom',['Flame','Steel']),.25);
 assert.equal(engine.V2_calculateDamage({move:{...move,type:'Volt'},attacker:{...attacker,types:['Volt']},defender:{...defender,types:['Stone']}}).damage,0);
 assert.equal(engine.V2_stageMultiplier(99),4);assert.equal(engine.V2_stageMultiplier(-99),.25);
});

test('v2 PP and accuracy are immutable and deterministic',()=>{
 const mon={pp:{move:1,empty:0}};const spent=engine.V2_spendPp(mon,'move');assert.equal(spent.ok,true);assert.equal(spent.mon.pp.move,0);assert.equal(mon.pp.move,1);
 assert.equal(engine.V2_spendPp(spent.mon,'move').ok,false);assert.equal(engine.V2_allMovesEmpty(spent.mon,['move','empty']),true);
 assert.deepEqual(engine.V2_accuracyCheck(95,12345),engine.V2_accuracyCheck(95,12345));assert.equal(engine.V2_accuracyCheck(100,1).hit,true);
 assert.deepEqual(engine.V2_STRUGGLE,{id:'struggle',type:null,category:'physical',power:50,accuracy:100,maxPP:null,targetMode:'foe',recoilFraction:.25});
 const move={id:'move',type:'Volt',accuracy:1};
 assert.equal(engine.V2_moveGate({mon,move,targetTypes:['Gale'],guarded:true,rngState:1}).outcome,'guarded');
 assert.equal(engine.V2_moveGate({mon,move,targetTypes:['Stone'],rngState:1}).outcome,'immune');
 const missed=engine.V2_moveGate({mon,move:{...move,type:'Flame'},targetTypes:['Gale'],rngState:1});assert.equal(missed.outcome,'missed');assert.equal(missed.mon.pp.move,0);
 assert.equal(engine.V2_moveGate({mon:spent.mon,move,targetTypes:['Gale'],rngState:1}).outcome,'noPP');
 assert.equal(engine.V2_struggleRecoil(42),10);assert.equal(engine.V2_struggleRecoil(0),0);
});
