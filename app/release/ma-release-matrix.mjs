import {v3Catalog} from '../server/v3-catalog.mjs';
import {createV3BattleUnit} from '../server/v3-battle-factory.mjs';
import {applyMegaEvolution} from '../server/v3-mega.mjs';
import {createBattleLabState,stepBattleLab} from '../server/v3-battle-lab.mjs';
import {BattlePresentationRuntime} from '../public/js/presentation/battle-presentation-runtime.js';
import {presentationCoverage} from '../public/js/presentation/move-presentation.js';

const chunks=(list,size)=>Array.from({length:Math.ceil(list.length/size)},(_,i)=>list.slice(i*size,i*size+size));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function paddedGroup(group){const ids=[...group],used=new Set(ids);for(const species of v3Catalog.species)if(!used.has(species.id)){ids.push(species.id);used.add(species.id);if(ids.length===6)break;}return ids;}

function megaSmoke(relation,runtime){
 const species=v3Catalog.speciesById[relation.baseSpeciesId],defaults=species.defaultBuild,mon={monId:`mega-${species.id}`,speciesId:species.id,ownership:'permanent'},build={...structuredClone(defaults),buildId:`mega-build-${species.id}`,monId:mon.monId,name:`Mega ${species.name}`,itemId:relation.itemId},unit=createV3BattleUnit('A',0,build,mon,v3Catalog);
 if(relation.requiredGender)unit.gender=relation.requiredGender;
 const battle={id:`mega-${species.id}`,format:'single',phase:'COMMAND',phaseRevision:1,turn:1,activeCount:1,regulationId:v3Catalog.regulations[0].id,megaLimit:1,megaUsed:{A:0,B:0},field:{},sides:{A:{active:[unit.actorId],roster:[unit],conditions:{}},B:{active:[],roster:[],conditions:{}}},events:[]},result=applyMegaEvolution(battle,{side:'A',actorId:unit.actorId,mega:true},v3Catalog),event=result.events.find(entry=>entry.kind==='megaEvolved');
 assert(event?.toSpeciesId===relation.megaSpeciesId,`Mega smoke failed for ${relation.baseSpeciesId}`);
 const plan=runtime.plan({stage:'mega',duration:1000,events:[event]},v3Catalog);assert(plan?.cues?.some(cue=>cue.primitive==='actor-mega'),`Mega presentation missing for ${relation.megaSpeciesId}`);
 return event.toSpeciesId;
}

export function runMaReleaseMatrix(){
 const runtime=new BattlePresentationRuntime(),species=v3Catalog.species.map(entry=>entry.id),spawned={single:new Set(),double:new Set()},labTurns={single:0,double:0};
 for(const group of chunks(species,6))for(const mode of ['single','double']){
  const state=createBattleLabState(v3Catalog,{mode,speciesIds:paddedGroup(group),seed:1000+spawned[mode].size});const battle=state.battleV3.battle;
  for(const side of ['A','B'])for(const unit of battle.sides[side].roster)spawned[mode].add(unit.baseSpeciesId);
  const stepped=stepBattleLab(state,v3Catalog);assert(stepped.ok,`Battle Lab ${mode} turn failed: ${stepped.code||'unknown'}`);labTurns[mode]++;
 }
 assert(spawned.single.size===213,`Single spawn matrix covered ${spawned.single.size}/213`);assert(spawned.double.size===213,`Double spawn matrix covered ${spawned.double.size}/213`);
 const megaRelations=(v3Catalog.megaRelations||[]).filter(entry=>entry.regulationSets?.includes('m-a')),megaForms=new Set(megaRelations.map(relation=>megaSmoke(relation,runtime)));assert(megaForms.size===59,`Mega matrix covered ${megaForms.size}/59`);
 const specialCases=[['megaEvolved','actor-mega'],['transformed','actor-morph'],['illusionBroken','actor-shatter'],['disguiseBroken','actor-break'],['abilityFormChanged','actor-morph'],['twoTurnMovePrepared','actor-vanish'],['twoTurnMoveReleased','actor-emerge'],['fainted','actor-faint'],['switchIn','actor-emerge']];
 for(const [kind,primitive] of specialCases){const event={kind,actorId:'A-0',abilityId:kind==='abilityFormChanged'?'forecast':undefined,trigger:kind==='abilityFormChanged'?'weather':undefined,semiInvulnerable:kind.startsWith('twoTurn')?'underground':undefined},plan=runtime.plan({stage:'impact',duration:1000,events:[event]},v3Catalog);assert(plan?.cues?.some(cue=>cue.primitive===primitive),`Special presentation missing ${kind}/${primitive}`);}
 const fx=presentationCoverage(v3Catalog.moves);assert(fx.length===490&&fx.every(entry=>entry.commit),`Move presentation matrix invalid: ${fx.length}`);
 return {single:{speciesSpawned:spawned.single.size,labBattles:labTurns.single},double:{speciesSpawned:spawned.double.size,labBattles:labTurns.double},mega:{forms:megaForms.size},specialPresentation:{cases:specialCases.length},moveFx:{moves:fx.length,commitSafe:fx.filter(entry=>entry.commit).length}};
}
