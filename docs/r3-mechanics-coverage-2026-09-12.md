# R3 Mechanics Coverage — 2026-09-12

## Current state

The M-A candidate contains 862 mechanics-bearing entries: 516 moves, 180 Abilities and 166 items. The coverage generator evaluates every entry independently for Single and Double battles.

The first coverage baseline is:

- Single: 2 supported, 860 blocked.
- Double: 2 supported, 860 blocked.
- Supported moves: Tackle and Aerial Ace.
- Supported Abilities: none yet.
- Supported items: none yet.

Every unsupported entry currently resolves to `missing-manifest`. As implementation expands, more precise reasons such as `missing-handler:<id>`, `missing-test-evidence` and `invalid-manifest:<problem>` prevent incomplete mechanics from entering a legal build.

## Architecture

`app/mechanics-v3/manifest-contract.mjs` defines the accepted hooks and requires every move manifest to declare priority, target mode, contact behavior, ordered handlers and separate Single/Double test evidence.

`app/mechanics-v3/registry.mjs` executes handlers by explicit order. It clones battle state and payloads, rejects handler input mutation and returns a trace suitable for debugging and replay checks.

`app/mechanics-v3/coverage.mjs` derives support from manifests, registered handlers and test evidence. Support is never inferred from source descriptions or from `availableInChampions`.

`app/mechanics-v3/handlers/spend-pp.mjs` validates and consumes PP before execution. `app/mechanics-v3/handlers/direct-damage.mjs` consumes the R2 target and damage contracts, uses seeded accuracy, critical-hit and damage rolls, supports immunity and redirection, and emits authoritative damage breakdown events.

## Initial move evidence

PokéBase supplies the Champions power, type, category, accuracy and PP values. Pokémon Showdown's move data is used as an architecture and mechanics cross-check for fields absent from the PokéBase payload: <https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts>.

The local manifests explicitly record:

- Tackle: priority 0, contact, adjacent foe, direct damage.
- Aerial Ace: priority 0, contact, any adjacent target, always hits, direct damage.

The supporting fixtures cover normal Single damage, Ghost immunity, an adjacent ally target in Double and Double redirection. Neither move has been added to the schema-2 playable catalog; promotion remains part of R4.

## Rebuild coverage

```powershell
cd D:\Mon\AetherChampions\app
npm run mechanics:coverage -- pv-ma-2026-09-11
```

This writes `mechanics-coverage.json` and `mechanics-coverage.md` beside the normalized local candidate. The JSON matrix is the machine-readable source for future legality checks.
