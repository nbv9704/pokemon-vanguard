# Source contradictions

## 2026-09-17 — Mega Garchomp Z Ability

- Scope: Pokémon Champions Regulation M-A Mega content review.
- Entity: `garchomp-mega-z` / `garchompite-z`.
- Serebii Champions: `https://www.serebii.net/pokedex-champions/garchomp/` presents Mega Garchomp Z as a distinct form and lists Levitate for that block, with 1.9 m / 99 kg and stats 108/130/85/141/85/151.
- Pokémon Database: `https://pokemondb.net/pokedex/garchomp` also separates Mega Garchomp Z from classic Mega Garchomp, but currently lists Sand Force for the Z form.
- PokéBase Champions: `https://pokebase.app/pokemon-champions/pokemon/garchomp-mega` supplies the classic Mega Garchomp record (Sand Force, 108/170/115/120/95/92); the Wave-5 promotion therefore maps only `garchompite` to classic `garchomp-mega`.
- Decision: keep `garchompite-z` / Mega Garchomp Z unpromoted and fail-closed until a Champions-specific authoritative source or direct capture resolves the Ability disagreement. Do not alias the Z form to classic Mega Garchomp.
- Affected runtime fixture: `tests/r6-mega-wave5.test.mjs` asserts classic `garchompite` relation exists and no `garchompite-z` relation is promoted.
