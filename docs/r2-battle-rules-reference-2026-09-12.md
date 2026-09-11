# R2 Battle Rules Reference — 2026-09-12

## Purpose

This note records the verified foundation used by `app/rules-v3/`. It separates rules that are safe to encode now from move-, Ability- and item-specific mechanics that belong to R3. The schema-2 runtime remains a compatibility fixture until the schema-3 catalog and team flow are ready.

## Sources and verified values

- PokéBase Champions Damage Calculator: <https://pokebase.app/pokemon-champions/damage-calc>
- PokéBase Champions Team Builder: <https://pokebase.app/pokemon-champions/team-builder>

The calculator client inspected on 2026-09-12 fixes battles at level 50 and calculates final stats from base stats, Stat Points and nature:

- HP: `base HP + 75 + HP Stat Points`.
- Other stats: `floor((base stat + 20 + Stat Points) × nature modifier)`.
- Nature modifier: `1.1` for the raised stat, `0.9` for the lowered stat and `1.0` otherwise.
- Stat Points: at most 32 in one stat and at most 66 across all six stats.

The calculator passes those final stats to the Gen 9 Smogon damage calculator. R2 therefore locks the common level-50 damage core, 85–100 random rolls, STAB, canonical type effectiveness, spread reduction, critical-hit placement and physical burn reduction. R3 must verify every special modifier before enabling its move, Ability or item.

## Implemented shadow contract

`app/rules-v3/rules-contract.json` identifies the rules independently from catalog data. The pure modules currently provide:

- all 18 canonical types, including one- and two-type effectiveness;
- all 25 natures and validated 66/32 Stat Point allocation;
- the level-50 base damage path and a reproducible 16-roll damage range;
- deterministic action ordering for replacement, switching, priority, speed, Trick Room and ties;
- Single and Double target discovery for self, ally, foe, adjacent spread, side and field modes.

The candidate importer reads the canonical type vocabulary from this contract, so import validation and future runtime rules cannot silently diverge.

## R2 boundary

The current modules are not yet the active battle engine. R2 still needs integration fixtures for action cancellation, faint/replacement windows, end-of-turn groups, redirection and replay equality. Those rules must consume immutable battle snapshots containing both `rulesVersion` and `catalogVersion`.

R3 owns move-specific base power, fixed and variable damage, multi-hit behavior, screens, weather exceptions, terrain, status and volatile interactions, Ability hooks, item hooks, alternate STAB rules and every other named modifier. A description never enables a mechanic by itself.

## Golden evidence

`app/tests/r2-rules.test.mjs` locks representative immunity, ¼× and 4× dual typing, nature rounding, the complete 16-roll damage range, spread damage, burn, action ordering and Single/Double target selection. Run it with:

```powershell
cd D:\Mon\AetherChampions\app
node --test tests/r2-rules.test.mjs
```
