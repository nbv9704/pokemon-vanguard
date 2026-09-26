import {applyReplacements,completeEntry,replacementRequirements,resolveActionQueue,resumeActionQueue,unitById,validateReplacements} from '../rules-v3/index.mjs';
import {createMoveChoiceValidator,effectiveBattleSpeed,prepareTurnOrderMechanics,resolveEntryHazards,resolveFaintAbilityCopiesFromEvents,resolveMechanicsEndTurn,roomActive} from '../mechanics-v3/index.mjs';
import {applyMechanicsReplacementSwitch} from '../mechanics-v3/switch-lifecycle.mjs';
import {handlersFor,normalizeCommands} from './v3-battle-actions.mjs';
import {mechanicCatalog} from './v3-battle-factory.mjs';
import {projectV3Events,v3BattleSnapshotFor} from './v3-battle-view.mjs';
import {validateMegaChoice} from './v3-mega.mjs';

const clone=value=>structuredClone(value),other=side=>side==='A'?'B':'A';
export const publicOpponentRoster=(roster=[])=>roster.map(({buildId,...entry})=>clone(entry));
const rawTurnView=(raw,side)=>raw?{initial:v3BattleSnapshotFor(raw.initial,side),final:v3BattleSnapshotFor(raw.final,side)}:null;

export function pvpBattleView(match,side,{kind='training-pvp',difficulty='trainer',participantView=participant=>({name:participant.name,connected:participant.connected!==false}),rating=false}={}){
 const you=match.participants[side],foe=match.participants[other(side)],battle=match.battle,opponent=participantView(foe);
 if(!battle)return (match.finished||match.settled)?null:{id:match.id,phase:'PREVIEW',mode:match.mode,difficulty,kind,ownSide:side,playerRoster:clone(you.roster),opponentRoster:publicOpponentRoster(foe.roster),opponent,youLocked:!!you.lockedBuildIds,rankedWaiting:you.lockedBuildIds&&!foe.lockedBuildIds?'opponent-preview':null};
 const ownPending=match.pending.commands?.[battle.phaseRevision]?.[side],required=replacementRequirements(battle,side).slots.length>0,replacementPending=match.pending.replacements?.[battle.phaseRevision]?.[side],waiting=battle.phase==='COMMAND'&&ownPending?'opponent-command':battle.phase==='REPLACE'&&(!required||replacementPending)?'opponent-replacement':null;
 return {id:match.id,phase:battle.phase,mode:match.mode,difficulty,kind,ownSide:side,snapshot:v3BattleSnapshotFor(battle,side),turnSnapshots:rawTurnView(match.lastTurnRaw,side),events:projectV3Events(battle,match.lastEvents,side),history:projectV3Events(battle,battle.events,side),opponentRoster:publicOpponentRoster(foe.roster),opponent,rankedWaiting:waiting,...(rating?{ratingDelta:match.ratingDelta?.[side]??null,ratingAfter:match.ratingAfter?.[side]??null}:{})};
}

export function resolvePvpCommands(match,catalog){
 const battle=match.battle,revision=battle.phaseRevision,pending=match.pending.commands?.[revision];if(!pending?.A||!pending?.B)return {ok:true,resolved:false};
 const a=normalizeCommands(battle,'A',pending.A,catalog);if(!a.ok)return a;const b=normalizeCommands(battle,'B',pending.B,catalog);if(!b.ok)return b;
 const runtime=handlersFor(catalog),choiceValidator=createMoveChoiceValidator({moves:catalog.movesById,manifests:runtime.manifests.moves}),resolving=clone(battle);resolving.phase='RESOLVE';const initial=clone(battle),resolved=resolveActionQueue(resolving,[...a.actions,...b.actions],runtime.handlers,{validateAction:(current,queued)=>{const valid=choiceValidator(current,queued);return valid.ok?validateMegaChoice(current,queued,catalog):valid;},getSpeed:(current,queued)=>effectiveBattleSpeed(current,unitById(current,queued.actorId)),isTrickRoom:current=>roomActive(current,'trick-room'),prepareTurnOrder:(current,actions,orderRuntime)=>prepareTurnOrderMechanics(current,actions,orderRuntime,{moveManifests:runtime.manifests.moves}),afterAction:(current,events)=>resolveFaintAbilityCopiesFromEvents(current,events,{manifests:runtime.manifests})});if(!resolved.ok)return resolved;
 const ended=resolved.battle.phase==='END_TURN'?resolveMechanicsEndTurn(resolved.battle,[],{manifests:runtime.manifests,moves:catalog.movesById}):resolved;match.battle=ended.battle;match.lastEvents=[...resolved.events,...(ended===resolved?[]:ended.events)];match.lastTurnRaw={initial,final:clone(ended.battle)};delete match.pending.commands[revision];return {ok:true,resolved:true};
}

export function resolvePvpReplacements(match,catalog){
 const battle=match.battle,revision=battle.phaseRevision,required={A:replacementRequirements(battle,'A'),B:replacementRequirements(battle,'B')},pending=match.pending.replacements?.[revision]||{};
 for(const side of ['A','B'])if(required[side].slots.length&&!pending[side])return {ok:true,resolved:false};
 const choices={A:[],B:[]};for(const side of ['A','B']){if(!required[side].slots.length)continue;const valid=validateReplacements(battle,side,pending[side]);if(!valid.ok)return valid;choices[side]=valid.choices;}
 const manifests=mechanicCatalog(catalog),applied=applyReplacements(battle,choices,{applyLiveSwitch:(current,side,actorId,toId,request)=>applyMechanicsReplacementSwitch(current,side,actorId,toId,{manifests,request})});if(!applied.ok)return applied;
 const hazards=resolveEntryHazards(applied.battle,applied.events,{manifests,moves:catalog.movesById}),entered=completeEntry(hazards.battle,hazards.events),events=[...applied.events,...entered.events];let final=entered;
 if(entered.battle.phase==='RESOLVE'){const runtime=handlersFor(catalog),resumed=resumeActionQueue(entered.battle,runtime.handlers,{getSpeed:(current,queued)=>effectiveBattleSpeed(current,unitById(current,queued.actorId)),isTrickRoom:current=>roomActive(current,'trick-room'),afterAction:(current,ev)=>resolveFaintAbilityCopiesFromEvents(current,ev,{manifests:runtime.manifests})});if(!resumed.ok)return resumed;events.push(...resumed.events);final=resumed.battle.phase==='END_TURN'?resolveMechanicsEndTurn(resumed.battle,[],{manifests:runtime.manifests,moves:catalog.movesById}):resumed;if(final!==resumed)events.push(...final.events);}
 match.battle=final.battle;match.lastEvents=events;if(match.lastTurnRaw)match.lastTurnRaw.final=clone(final.battle);delete match.pending.replacements[revision];return {ok:true,resolved:true};
}
