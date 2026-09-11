# R2 Battle Rules Reference — 2026-09-12

## Purpose

This note records the verified foundation used by `app/rules-v3/`. It separates rules that are safe to encode now from move-, Ability- and item-specific mechanics that belong to R3. The schema-2 runtime remains a compatibility fixture until the schema-3 catalog and team flow are ready.

## Sources and verified values

- PokéBase Champions Damage Calculator: <https://pokebase.app/pokemon-champions/damage-calc>
- PokéBase Champions Team Builder: <https://pokebase.app/pokemon-champions/team-builder>
- PokéBase Champions Speed Tiers: <https://pokebase.app/pokemon-champions/speed-tiers>
- Current turn-order report: <https://as.com/meristation/noticias/entendiendo-la-prioridad-en-pokemon-champions-por-que-el-clima-afecta-tanto-al-meta-y-como-aprovecharlo-en-nuestro-beneficio-f202604-n/>

The calculator client inspected on 2026-09-12 fixes battles at level 50 and calculates final stats from base stats, Stat Points and nature:

- HP: `base HP + 75 + HP Stat Points`.
- Other stats: `floor((base stat + 20 + Stat Points) × nature modifier)`.
- Nature modifier: `1.1` for the raised stat, `0.9` for the lowered stat and `1.0` otherwise.
- Stat Points: at most 32 in one stat and at most 66 across all six stats.

The calculator passes those final stats to the Gen 9 Smogon damage calculator. R2 therefore locks the common level-50 damage core, 85–100 random rolls, STAB, canonical type effectiveness, spread reduction, critical-hit placement and physical burn reduction. R3 must verify every special modifier before enabling its move, Ability or item.

Current Champions observations place switching before Mega Evolution and Mega Evolution before moves. Speed changes from a transformation or earlier action can reorder actors that have not acted. R2 models that dynamic ordering while generating each tie key exactly once from the battle seed. R6 will retain capture fixtures for Mega-specific legality and transformation effects.

## Implemented shadow contract

`app/rules-v3/rules-contract.json` identifies the rules independently from catalog data. The pure modules currently provide:

- all 18 canonical types, including one- and two-type effectiveness;
- all 25 natures and validated 66/32 Stat Point allocation;
- the level-50 base damage path and a reproducible 16-roll damage range;
- deterministic action ordering for replacement, switching, priority, speed, Trick Room and ties;
- switch → Mega → move timing with dynamic speed recalculation for actors that have not acted;
- Single and Double target discovery for self, ally, foe, adjacent spread, side and field modes.
- faint cancellation, exact replacement windows, ordered end-turn HP groups and temporary redirection cleanup;
- immutable snapshots that pin `rulesVersion` and `catalogVersion`, plus byte-identical seeded replay.

The candidate importer reads the canonical type vocabulary from this contract, so import validation and future runtime rules cannot silently diverge.

## R2 boundary

The current modules are not yet the active battle engine. R3 supplies the move, Ability, item and field handlers consumed by the R2 executor. R4 promotes the reviewed schema-3 catalog and connects snapshots to the local runtime. Until then, schema 2 remains the playable compatibility path.

R3 owns move-specific base power, fixed and variable damage, multi-hit behavior, screens, weather exceptions, terrain, status and volatile interactions, Ability hooks, item hooks, alternate STAB rules and every other named modifier. A description never enables a mechanic by itself.

## Golden evidence

`app/tests/r2-rules.test.mjs` locks representative immunity, ¼× and 4× dual typing, nature rounding, the complete 16-roll damage range, spread damage, burn, action ordering and Single/Double target selection. `app/tests/r2-lifecycle.test.mjs` locks snapshot versions, switch/Mega/move timing, dynamic speed, redirection, faint cancellation, end-turn groups, replacement and replay equality. Run them with:

```powershell
cd D:\Mon\AetherChampions\app
node --test tests/r2-rules.test.mjs tests/r2-lifecycle.test.mjs
```
