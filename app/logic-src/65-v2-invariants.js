function V2_assertBattleInvariants(battle) {
  const occupied = new Set();
  for (const side of ['A', 'B']) {
    const rosterIds = new Set(battle.sides[side].roster.map(mon => mon.battleMonId));
    for (const id of battle.sides[side].active.filter(Boolean)) {
      if (!rosterIds.has(id)) throw new Error(`active mon ${id} is outside ${side} roster`);
      if (occupied.has(id)) throw new Error(`active mon ${id} occupies multiple slots`);
      occupied.add(id);
    }
    for (const mon of battle.sides[side].roster) {
      if (!Number.isFinite(mon.hp) || mon.hp < 0 || mon.hp > mon.stats.hp) throw new Error(`invalid HP for ${mon.battleMonId}`);
      for (const value of Object.values(mon.pp)) if (!Number.isInteger(value) || value < 0) throw new Error(`invalid PP for ${mon.battleMonId}`);
      for (const value of Object.values(mon.stages)) if (!Number.isInteger(value) || value < -6 || value > 6) throw new Error(`invalid stage for ${mon.battleMonId}`);
    }
  }
  const inspect = value => {
    if (value === undefined) throw new Error('battle contains undefined');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('battle contains a non-finite number');
    if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') Object.values(value).forEach(inspect);
  };
  inspect(battle);
  const encoded = JSON.stringify(battle);
  if (JSON.stringify(JSON.parse(encoded)) !== encoded) throw new Error('battle is not JSON stable');
  return true;
}
