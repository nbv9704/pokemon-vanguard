import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 CANONICAL_TYPES,TYPE_CHART,typeEffectiveness,
 STAT_POINT_BUDGET,STAT_POINT_CAP,NATURES,validateStatPoints,calculateLevel50Stats,
 baseDamage,calculateDamage,damageRange,
 orderTurnActions,legalTargets,resolveTargets
} from '../rules-v3/index.mjs';

test('R2 contract pins the level 50 formats and stat limits',async()=>{
 const contract=JSON.parse(await readFile(new URL('../rules-v3/rules-contract.json',import.meta.url),'utf8'));
 assert.equal(contract.battleLevel,50);
 assert.equal(contract.statPointBudget,STAT_POINT_BUDGET);
 assert.equal(contract.statPointCap,STAT_POINT_CAP);
 assert.deepEqual(contract.formats,['single','double']);
 assert.deepEqual(contract.randomDamageRolls,[85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100]);
});

test('canonical type chart covers all 18 attacking and defending types',()=>{
 assert.equal(CANONICAL_TYPES.length,18);
 assert.equal(Object.keys(TYPE_CHART).length,18);
 for(const row of Object.values(TYPE_CHART))assert.equal(Object.keys(row).length,18);
 assert.equal(typeEffectiveness('electric',['ground']),0);
 assert.equal(typeEffectiveness('fire',['water']),.5);
 assert.equal(typeEffectiveness('normal',['normal']),1);
 assert.equal(typeEffectiveness('water',['fire']),2);
 assert.equal(typeEffectiveness('fire',['grass','steel']),4);
 assert.equal(typeEffectiveness('grass',['fire','steel']),.25);
 assert.equal(typeEffectiveness('ghost',['normal','psychic']),0);
 assert.equal(typeEffectiveness('fighting',['normal','ghost']),0);
 assert.throws(()=>typeEffectiveness('fire',['fire','fire']),/distinct canonical types/);
});

test('level 50 stats apply 66-point budget, 32 cap and nature rounding',()=>{
 assert.equal(Object.keys(NATURES).length,25);
 const base={hp:80,atk:130,def:60,spa:40,spd:80,spe:120};
 const points={hp:2,atk:32,def:0,spa:0,spd:0,spe:32};
 assert.deepEqual(calculateLevel50Stats(base,points,'jolly'),{hp:157,atk:182,def:80,spa:54,spd:100,spe:189});
 assert.match(validateStatPoints({...points,hp:3})[0],/exceeds 66/);
 assert.match(validateStatPoints({...points,atk:33})[0],/atk must be an integer from 0 to 32/);
});

test('damage core locks base formula, modifier order, spread, burn and immunity',()=>{
 const input={power:120,attack:200,defense:100,moveType:'fighting',attackerTypes:['fighting'],defenderTypes:['normal']};
 assert.equal(baseDamage(input),107);
 assert.deepEqual(damageRange(input),[270,276,278,282,284,288,290,294,296,300,302,306,308,312,314,320]);
 assert.equal(calculateDamage({...input,spread:true}).damage,240);
 assert.equal(calculateDamage({...input,critical:true}).damage,480);
 assert.equal(calculateDamage({...input,burned:true}).damage,160);
 assert.equal(calculateDamage({...input,moveType:'ghost',attackerTypes:['ghost']}).damage,0);
});

test('turn order resolves action class, priority, speed, Trick Room and ties',()=>{
 const actions=[
  {actorId:'slow',kind:'move',priority:0,speed:80,tieKey:1},
  {actorId:'fast',kind:'move',priority:0,speed:160,tieKey:1},
  {actorId:'priority',kind:'move',priority:1,speed:40,tieKey:1},
  {actorId:'switch',kind:'switch',speed:60,tieKey:1},
  {actorId:'replace',kind:'replace',speed:20,tieKey:1}
 ];
 assert.deepEqual(orderTurnActions(actions).map(action=>action.actorId),['replace','switch','priority','fast','slow']);
 assert.deepEqual(orderTurnActions(actions,{trickRoom:true}).map(action=>action.actorId),['replace','switch','priority','slow','fast']);
 const ties=[{actorId:'a',kind:'move',speed:100,tieKey:2},{actorId:'b',kind:'move',speed:100,tieKey:9}];
 assert.deepEqual(orderTurnActions(ties).map(action=>action.actorId),['b','a']);
});

test('target rules distinguish selectable and spread targets in single and double battles',()=>{
 const single={sides:{A:{active:['a1']},B:{active:['b1']}}};
 assert.deepEqual(legalTargets(single,{side:'A',actorId:'a1',targetMode:'adjacentFoe'}).map(target=>target.actorId),['b1']);
 assert.deepEqual(legalTargets(single,{side:'A',actorId:'a1',targetMode:'adjacentAlly'}),[]);
 const double={sides:{A:{active:['a1','a2']},B:{active:['b1','b2']}}};
 assert.deepEqual(legalTargets(double,{side:'A',actorId:'a1',targetMode:'anyAdjacent'}).map(target=>target.actorId),['a2','b1','b2']);
 assert.deepEqual(resolveTargets(double,{side:'A',actorId:'a1',targetMode:'adjacentFoe',target:{side:'B',slot:1}}).map(target=>target.actorId),['b2']);
 assert.deepEqual(resolveTargets(double,{side:'A',actorId:'a1',targetMode:'allAdjacentFoes'}).map(target=>target.actorId),['b1','b2']);
 assert.deepEqual(resolveTargets(double,{side:'A',actorId:'a1',targetMode:'userSide'}),[{scope:'side',side:'A'}]);
 assert.deepEqual(resolveTargets(double,{side:'A',actorId:'a1',targetMode:'foeSide'}),[{scope:'side',side:'B'}]);
 assert.deepEqual(resolveTargets(double,{side:'A',actorId:'a1',targetMode:'field'}),[{scope:'field'}]);
});
