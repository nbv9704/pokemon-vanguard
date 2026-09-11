function V2_setMon(battle, mon) {
  const next = V2_clone(battle);
  V2_replaceMon(next, mon);
  return next;
}

function V2_combatStats(mon, battle, side) {
  const copy = V2_clone(mon);
  for (const stat of ['atk', 'def', 'spa', 'spd']) {
    copy.stats[stat] = V2_effectiveStat(mon, stat, battle, side);
    copy.stages[stat] = 0;
  }
  return copy;
}

function V2_resolveAttack(battle, entry, move) {
  let current = V2_clone(battle);
  let rngState = current.rngState >>> 0;
  const rawEvents = [];
  const actor = V2_monById(current, entry.actorId);
  const spent = move.id === 'struggle' ? {ok: true, mon: actor} : V2_spendPp(actor, move.id);
  if (!spent.ok) return {battle: current, events: [{kind: 'moveFailed', actorId: entry.actorId, reason: 'noPP'}]};
  current = V2_setMon(current, spent.mon);
  rawEvents.push({kind: 'moveStarted', actorId: entry.actorId, moveId: move.id});

  const targets = V2_resolveTargets(current, entry.side, entry.actorId, move, entry.command.target);
  if (!targets.length) return {battle: current, events: [...rawEvents, {kind: 'moveFailed', actorId: entry.actorId, moveId: move.id, reason: 'noTarget'}]};
  const spread = move.targetMode === 'allFoes' && targets.length > 1 ? 0.75 : 1;
  let totalDamage = 0;

  for (const targetRef of targets.sort((a, b) => a.slot - b.slot)) {
    let attacker = V2_monById(current, entry.actorId);
    let defender = V2_monById(current, targetRef.battleMonId);
    if (!attacker || attacker.hp <= 0 || !defender || defender.hp <= 0) continue;
    if (defender.volatiles.guarded) {
      rawEvents.push({kind: 'guarded', actorId: entry.actorId, targetId: defender.battleMonId, moveId: move.id});
      continue;
    }
    const effectiveness = move.type ? V2_effectiveness(move.type, defender.types) : 1;
    if (effectiveness === 0) {
      rawEvents.push({kind: 'damage', actorId: entry.actorId, targetId: defender.battleMonId, moveId: move.id, hpBefore: defender.hp, hpAfter: defender.hp, amount: 0, effectiveness});
      continue;
    }
    const defenderSide = entry.side === 'A' ? 'B' : 'A';
    const allies = V2_activeEntries(current, entry.side).map(item => item.mon);
    const modifiers = V2_damageModifiers({attacker, defender, battle: current, attackerSide: entry.side, defenderSide, move, allies});
    const accuracy = V2_accuracyCheck(modifiers.accuracy, rngState);
    rngState = accuracy.rngState;
    if (!accuracy.hit) {
      rawEvents.push({kind: 'moveMissed', actorId: entry.actorId, targetId: defender.battleMonId, moveId: move.id});
      continue;
    }
    const damageInfo = move.id === 'struggle'
      ? V2_calculateDamage({...{move: {...move, type: null}}, attacker: V2_combatStats(attacker, current, entry.side), defender: V2_combatStats(defender, current, defenderSide), field: {}, spread})
      : V2_calculateDamage({move, attacker: V2_combatStats(attacker, current, entry.side), defender: V2_combatStats(defender, current, defenderSide), field: current.field, outgoing: modifiers.outgoing, incoming: modifiers.incoming, spread});
    const survived = V2_surviveLethal(defender, damageInfo.damage);
    defender = survived.mon;
    const hpBefore = defender.hp;
    const actual = Math.min(hpBefore, survived.damage);
    defender.hp -= actual;
    current = V2_setMon(current, defender);
    totalDamage += actual;
    if (survived.trigger) rawEvents.push({kind: survived.trigger === 'focus-crystal' ? 'itemTriggered' : 'abilityTriggered', sourceId: defender.battleMonId, effectId: survived.trigger});
    rawEvents.push({kind: 'damage', actorId: entry.actorId, targetId: defender.battleMonId, moveId: move.id, hpBefore, hpAfter: defender.hp, amount: actual, effectiveness});
    if (defender.hp === 0) rawEvents.push({kind: 'fainted', targetId: defender.battleMonId});

    const healed = V2_afterDamage({attacker: V2_monById(current, entry.actorId), defender: V2_monById(current, defender.battleMonId), damage: actual, move, rngState, skipReactions: true});
    rngState = healed.rngState; current = V2_setMon(V2_setMon(current, healed.attacker), healed.defender); rawEvents.push(...healed.events);
    if (actual > 0 && V2_monById(current, defender.battleMonId).hp > 0) {
      current.rngState = rngState;
      const secondary = V2_applyMoveEffects(current, entry, move, 'afterDamage', defender.battleMonId);
      current = secondary.battle; rngState = current.rngState; rawEvents.push(...secondary.events);
    }
    const triedPoison = (move.effects || []).some(effect => effect.timing === 'afterDamage' && effect.kind === 'applyStatus' && effect.params?.status === 'poison');
    const reacted = V2_afterDamage({attacker: V2_monById(current, entry.actorId), defender: V2_monById(current, defender.battleMonId), damage: actual, move, rngState, moveTriedPoison: triedPoison, skipHealing: true});
    rngState = reacted.rngState; current = V2_setMon(V2_setMon(current, reacted.attacker), reacted.defender); rawEvents.push(...reacted.events);
  }
  if (move.id === 'struggle' && totalDamage > 0) {
    const recoil = V2_struggleRecoil(totalDamage);
    const source = V2_monById(current, entry.actorId);
    const hpBefore = source.hp;
    source.hp = Math.max(0, source.hp - recoil);
    current = V2_setMon(current, source);
    rawEvents.push({kind: 'damage', actorId: entry.actorId, targetId: entry.actorId, moveId: move.id, hpBefore, hpAfter: source.hp, amount: hpBefore - source.hp, source: 'recoil'});
    if (source.hp === 0) rawEvents.push({kind: 'fainted', targetId: source.battleMonId});
  }
  current.rngState = rngState;
  return {battle: current, events: rawEvents};
}

function V2_resolveUtility(battle, entry, move) {
  let current = V2_clone(battle);
  const actor = V2_monById(current, entry.actorId);
  const spent = V2_spendPp(actor, move.id);
  if (!spent.ok) return {battle: current, events: [{kind: 'moveFailed', actorId: entry.actorId, reason: 'noPP'}]};
  current = V2_setMon(current, spent.mon);
  const events = [{kind: 'moveStarted', actorId: entry.actorId, moveId: move.id}];
  if (move.id === 'guard') {
    const guarded = V2_guardAttempt(V2_monById(current, entry.actorId), current.rngState);
    current = V2_setMon(current, guarded.mon);
    current.rngState = guarded.rngState;
    events.push({kind: guarded.success ? 'guarded' : 'moveFailed', actorId: entry.actorId, moveId: move.id, reason: guarded.success ? undefined : 'guardChain'});
    return {battle: current, events};
  }
  current = V2_setMon(current, V2_resetGuard(V2_monById(current, entry.actorId)));
  return V2_mergeResolution(current, events, V2_applyMoveEffects(current, entry, move, 'onUse'));
}

function V2_mergeResolution(battle, events, result) {
  return {battle: result.battle || battle, events: [...events, ...(result.events || [])]};
}

function V2_resolveTurn(battle, moves) {
  if (battle.phase !== 'RESOLVE') return {ok: false, code: 'WRONG_PHASE'};
  const input = JSON.stringify(battle);
  let current = V2_clone(battle);
  let rawEvents = [{kind: 'turnStarted', turn: current.turn}];
  for (const entry of current.queue || []) {
    const actor = V2_monById(current, entry.actorId);
    if (!actor || actor.hp <= 0 || !current.sides[entry.side].active.includes(entry.actorId)) {
      rawEvents.push({kind: 'moveFailed', actorId: entry.actorId, reason: 'actorUnavailable'});
      continue;
    }
    if (entry.command.kind === 'switch') {
      const switched = V2_applySwitch(current, entry.side, entry.actorId, entry.command.toId);
      if (!switched.ok) continue;
      current = switched.battle; rawEvents.push(...switched.events);
      const entered = V2_entryAbility(current, entry.side, entry.command.toId);
      current = entered.battle; rawEvents.push(...entered.events);
    } else {
      const sleep = V2_sleepGate(actor);
      current = V2_setMon(current, sleep.mon);
      if (!sleep.canAct) { rawEvents.push({kind: 'moveFailed', actorId: entry.actorId, reason: 'asleep'}); continue; }
      if (sleep.woke) rawEvents.push({kind: 'statusCured', targetId: entry.actorId, status: 'sleep'});
      const move = entry.command.moveId === 'struggle' ? V2_STRUGGLE : moves[entry.command.moveId];
      const result = move.category === 'status' ? V2_resolveUtility(current, entry, move) : V2_resolveAttack(current, entry, move);
      current = result.battle; rawEvents.push(...result.events);
    }
    const result = V2_checkResult(current);
    current = result.battle; rawEvents.push(...result.events);
    if (current.phase === 'FINISHED') break;
  }
  if (current.phase !== 'FINISHED') {
    current.phase = 'END_TURN'; current.phaseRevision = (current.phaseRevision || 0) + 1;
    const ended = V2_endTurn(current); current = ended.battle; rawEvents.push(...ended.events);
  }
  const committed = V2_commitEvents(current, rawEvents.map(event => ({...event, turn: event.turn ?? battle.turn})));
  if (JSON.stringify(battle) !== input) throw new Error('V2_resolveTurn mutated its input');
  return {ok: true, battle: committed.battle, events: committed.events};
}
