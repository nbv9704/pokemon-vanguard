# R6 Mega Evolution reference — 2026-09-13

## Activated beta relation

`venusaur + venusaurite → venusaur-mega`

- Regulation: M-A local beta, one Mega Evolution per side per battle.
- Mega form: Grass/Poison; base stats 80/100/123/122/120/80; Ability Thick Fat.
- Thick Fat: incoming Fire- and Ice-type damage multiplier 0.5.
- Sources: [Mega Venusaur](https://pokebase.app/pokemon-champions/pokemon/venusaur-mega), [Venusaurite](https://pokebase.app/pokemon-champions/items/venusaurite?regulation=m-a), [PokeAPI sprites](https://github.com/PokeAPI/sprites).

The source record is stored in `app/content-src/mega-beta-v1.json`. Mega forms remain separate from recruitable species, while their Ability and Mega Stone are available to the battle catalog. This prevents Mega Venusaur from appearing as a Roster Ranch species.

## Runtime contract

1. Team/build validation permits Venusaurite as a held item and Item Clause still applies.
2. Command submission accepts `mega: true` only on a move action from an active, living, compatible stone holder.
3. The turn resolver runs switch actions, then Mega transformations, then dynamically ordered moves.
4. Transformation preserves damage taken, PP, status, stages and volatiles; recalculates level-50 stats; swaps identity, types, sprite and active Ability; recompiles passive effects.
5. The public event exposes the new form and Ability only when transformation resolves.
6. The transformation persists after switching and the side cannot Mega Evolve again.

## Evidence matrix

- Single and Double transformation ordering.
- Missing stone, unavailable actor and one-per-side rejection.
- HP damage, PP, status, stages and volatile continuity.
- Thick Fat positive Fire/Ice modifier evidence and ordinary damage comparison.
- Ordered UI frame before move cast, local front/back assets and Battle Log projection.
- Full suite: 272/272 passing on 2026-09-13.
