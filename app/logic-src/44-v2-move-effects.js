function V2_effectTargetIds(battle, entry, move, effect, hitTargetId) {
  if (effect.target === 'self') return [entry.actorId];
  if (effect.target === 'hitTarget') {
    if (hitTargetId) return [hitTargetId];
    return V2_resolveTargets(battle, entry.side, entry.actorId, move, entry.command.target).map(target => target.battleMonId);
  }
  if (effect.target === 'ally') {
    const targets = V2_resolveTargets(battle, entry.side, entry.actorId, {targetMode: 'ally'}, entry.command.target);
    return targets.map(target => target.battleMonId);
  }
  return [];
}

function V2_effectChance(chance, rngState) {
  if (chance === undefined || chance >= 1) return {passed: true, rngState};
  const roll = V2_nextRandom(rngState);
  return {passed: roll.value < chance, rngState: roll.state};
}

function V2_applyMoveEffects(battle, entry, move, timing, hitTargetId = null) {
  let current = V2_clone(battle);
  let rngState = current.rngState >>> 0;
  const events = [];
  for (const effect of (move.effects || []).filter(item => item.timing === timing)) {
    const chance = V2_effectChance(effect.chance, rngState);
    rngState = chance.rngState;
    if (!chance.passed) continue;
    const params = effect.params || {};
    if (effect.kind === 'setWeather') {
      const result = V2_setField(current, 'weather', params.id || params.weather, entry.actorId);
      current = result.battle; events.push(...result.events); continue;
    }
    if (effect.kind === 'setTerrain') {
      const result = V2_setField(current, 'terrain', params.id || params.terrain, entry.actorId);
      current = result.battle; events.push(...result.events); continue;
    }
    if (effect.kind === 'setSideCondition') {
      const result = V2_setSideCondition(current, entry.side, params.id, params.remaining);
      current = result.battle; events.push(...result.events); continue;
    }
    for (const targetId of V2_effectTargetIds(current, entry, move, effect, hitTargetId)) {
      let target = V2_monById(current, targetId);
      if (!target || target.hp <= 0 || (target.volatiles.guarded && target.ownerSide !== entry.side)) continue;
      if (effect.kind === 'applyStatus') {
        const result = V2_applyStatus(target, params.status);
        current = V2_setMon(current, result.mon); events.push(...result.events);
      } else if (effect.kind === 'changeStage') {
        const result = V2_changeStage(target, params.stat, params.amount, {fromFoe: target.ownerSide !== entry.side});
        current = V2_setMon(current, result.mon);
        if (result.changed) events.push({kind: 'statChanged', actorId: entry.actorId, targetId, stat: params.stat, amount: params.amount});
      } else if (effect.kind === 'heal') {
        const amount = Math.min(target.stats.hp - target.hp, Math.floor(target.stats.hp * params.fraction));
        target = V2_clone(target); target.hp += amount; current = V2_setMon(current, target);
        if (amount > 0) events.push({kind: 'heal', actorId: entry.actorId, targetId, amount, hpAfter: target.hp});
      } else if (effect.kind === 'redirect') {
        target = V2_clone(target); target.volatiles.redirect = true; target.volatiles.redirectOrder = current.eventSequence || 0;
        current = V2_setMon(current, target);
      }
    }
  }
  current.rngState = rngState;
  return {battle: current, events};
}
