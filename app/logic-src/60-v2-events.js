const V2_EVENT_KINDS = new Set([
  'turnStarted', 'switchOut', 'switchIn', 'abilityTriggered', 'itemTriggered',
  'formChanged', 'moveStarted', 'moveFailed', 'moveMissed', 'guarded', 'damage',
  'heal', 'statusApplied', 'statusCured', 'statChanged', 'fieldChanged',
  'effectExpired', 'fainted', 'turnEnded', 'battleEnded'
]);

function V2_validateEvent(event) {
  if (!event || !V2_EVENT_KINDS.has(event.kind)) return {ok: false, reason: 'unknownKind'};
  if (event.kind === 'damage') {
    if (typeof event.targetId !== 'string' || !Number.isFinite(event.amount) || event.amount < 0) return {ok: false, reason: 'invalidDamage'};
    if (event.hpBefore !== undefined && (!Number.isFinite(event.hpBefore) || !Number.isFinite(event.hpAfter) || event.hpBefore - event.hpAfter !== event.amount)) return {ok: false, reason: 'invalidHpDelta'};
  }
  if (event.kind === 'heal' && (typeof event.targetId !== 'string' || !Number.isFinite(event.amount) || event.amount < 0)) return {ok: false, reason: 'invalidHeal'};
  return {ok: true};
}

function V2_commitEvents(battle, rawEvents, {depth = 0} = {}) {
  if (depth > 8) throw new Error('event dispatch depth exceeded');
  if (rawEvents.length > 256) throw new Error('event limit exceeded');
  const next = V2_clone(battle);
  let sequence = next.eventSequence || 0;
  const events = rawEvents.map(raw => {
    const valid = V2_validateEvent(raw);
    if (!valid.ok) throw new Error(`invalid event: ${valid.reason}`);
    return {...V2_clone(raw), id: `event-${++sequence}`, turn: raw.turn ?? next.turn};
  });
  next.eventSequence = sequence;
  next.events = [...(next.events || []), ...events];
  return {battle: next, events};
}

function V2_eventLogLine(event, names = {}) {
  const actor = names[event.actorId] || event.actorId || 'Battlefield';
  const target = names[event.targetId] || event.targetId || '';
  const messages = {
    turnStarted: `Turn ${event.turn} started`,
    switchOut: `${actor} withdrew`,
    switchIn: `${actor} entered the field`,
    abilityTriggered: `${names[event.sourceId] || event.sourceId}'s ${event.effectId || event.abilityId} activated`,
    itemTriggered: `${names[event.sourceId] || event.sourceId} used ${event.effectId || event.itemId}`,
    moveStarted: `${actor} used ${names[event.moveId] || event.moveId}`,
    moveFailed: `${actor}'s action failed: ${event.reason}`,
    moveMissed: `${actor} missed ${target}`,
    guarded: `${target || actor} guarded the attack`,
    damage: `${target} lost ${event.amount ?? Math.max(0,(event.hpPercentBefore||0)-(event.hpPercentAfter||0))+'%'} HP`,
    heal: `${target} recovered ${event.amount ?? Math.max(0,(event.hpPercentAfter||0)-(event.hpPercentBefore||0))+'%'} HP`,
    statusApplied: `${target} became ${event.status}`,
    statusCured: `${target} recovered from ${event.status}`,
    statChanged: `${target}'s ${event.stat} changed by ${event.amount}`,
    fieldChanged: `${event.field} became ${event.value}`,
    effectExpired: `${event.value} expired`,
    fainted: `${target} fainted`,
    turnEnded: `Turn ${event.turn} ended`,
    battleEnded: event.winner ? `${event.winner} won the battle` : 'The battle ended in a draw'
  };
  return messages[event.kind] || `[${event.kind}]`;
}

function V2_logPage(events, page = 0, pageSize = 20, names = {}) {
  const turns = [...new Set(events.map(event => event.turn))].sort((a, b) => b - a);
  const selected = new Set(turns.slice(page * pageSize, (page + 1) * pageSize));
  return events.filter(event => selected.has(event.turn)).map(event => ({id: event.id, turn: event.turn, text: V2_eventLogLine(event, names)}));
}

function V2_projectEvent(event, battle, viewerSide) {
  const projected = V2_clone(event);
  if (event.kind !== 'damage' && event.kind !== 'heal') return projected;
  const target = V2_monById(battle, event.targetId);
  if (!target || target.ownerSide === viewerSide) return projected;
  const max = target.stats.hp;
  projected.hpPercentBefore = Math.round((event.hpBefore ?? target.hp) / max * 100);
  projected.hpPercentAfter = Math.round((event.hpAfter ?? target.hp) / max * 100);
  delete projected.hpBefore; delete projected.hpAfter; delete projected.amount;
  return projected;
}

function V2_animationFrame(battle, viewerSide) {
  const frame = {};
  for (const side of ['A', 'B']) {
    const key = side === viewerSide ? 'allies' : 'enemies';
    frame[key] = battle.sides[side].active.map(id => {
      const mon = id ? V2_monById(battle, id) : null;
      return mon ? {id: mon.battleMonId, hp: mon.hp, max: mon.stats.hp, energy: 0, status: mon.status?.id || mon.status || null} : {id: null, hp: 0, max: 1, energy: 0, status: null};
    });
  }
  return frame;
}

function V2_toAnimationEvents(initialBattle, events, moves, viewerSide = 'A') {
  const state = V2_clone(initialBattle), result = [], activeMoves = new Map();
  const sideKey = side => side === viewerSide ? 'allies' : 'enemies';
  for (const event of events) {
    if (event.kind === 'moveStarted') { activeMoves.set(event.actorId, event.moveId); continue; }
    const target = event.targetId ? V2_monById(state, event.targetId) : null;
    if (target && Number.isFinite(event.hpAfter)) target.hp = event.hpAfter;
    if (target && event.kind === 'statusApplied') target.status = event.status;
    if (target && event.kind === 'statusCured') target.status = null;
    if (event.kind === 'switchIn') state.sides[event.side].active[event.slot] = event.actorId;
    if (event.kind === 'switchIn') {
      const mon = V2_monById(state, event.actorId);
      result.push({kind: event.replacement ? 'entry' : 'switch', side: sideKey(event.side), actor: event.slot, incoming: event.slot, name: mon?.speciesId || event.actorId, frame: V2_animationFrame(state, viewerSide)});
    } else if (event.kind === 'heal' && target) {
      const targetSlot = state.sides[target.ownerSide].active.indexOf(event.targetId);
      result.push({kind: 'upkeep', side: sideKey(target.ownerSide), actor: Math.max(0, targetSlot), name: target.speciesId || event.targetId, change: event.amount, frame: V2_animationFrame(state, viewerSide)});
    } else if (event.kind === 'fieldChanged') {
      const source = event.sourceId ? V2_monById(state, event.sourceId) : null;
      const sourceSide = source?.ownerSide || viewerSide;
      const sourceSlot = source ? state.sides[sourceSide].active.indexOf(source.battleMonId) : 0;
      const moveId = source ? activeMoves.get(source.battleMonId) : null;
      const move = moves[moveId] || {id: moveId || event.value, name: moveId || event.value, type: 'Astral', power: 0};
      result.push({kind: 'move', side: sideKey(sourceSide), actor: Math.max(0, sourceSlot), name: source?.speciesId || 'Battlefield', move: {name: move.name || move.id, type: move.type, power: 0, effect: 'weather', weather: event.value}, targets: [], frame: V2_animationFrame(state, viewerSide)});
    } else if (event.kind === 'damage' && target) {
      const actor = V2_monById(state, event.actorId), actorSide = actor?.ownerSide || target.ownerSide;
      const actorSlot = state.sides[actorSide].active.indexOf(event.actorId);
      const targetSlot = state.sides[target.ownerSide].active.indexOf(event.targetId);
      const move = moves[event.moveId] || {id: event.moveId || event.source, name: event.moveId || event.source, type: 'Venom', power: 0};
      result.push({kind: event.source && !event.moveId ? 'upkeep' : 'move', side: sideKey(actorSide), actor: Math.max(0, actorSlot), name: actor?.speciesId || event.actorId, move: {name: move.name || move.id, type: move.type, power: move.power, effect: move.targetMode === 'allFoes' ? 'spread' : 'damage'}, targets: [{side: sideKey(target.ownerSide), index: Math.max(0, targetSlot), damage: event.amount, effectiveness: event.effectiveness ?? 1, fainted: event.hpAfter === 0}], change: -event.amount, condition: event.source, frame: V2_animationFrame(state, viewerSide)});
    }
  }
  return result;
}
