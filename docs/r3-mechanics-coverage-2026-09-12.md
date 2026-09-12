# R3 Mechanics Coverage — 2026-09-12

## Current state

The M-A candidate contains 862 mechanics-bearing entries: 516 moves, 180 Abilities and 166 items. The coverage generator evaluates every entry independently for Single and Double battles.

The current coverage after accuracy/evasion and target-debuff support is:

- Single: 23 supported, 839 blocked.
- Double: 23 supported, 839 blocked.
- Supported moves: Tackle, Aerial Ace, Acid Armor, Agility, Amnesia, Aromatic Mist, Baby-Doll Eyes, Bulk Up, Calm Mind, Charm, Coaching, Coil, Confide, Cosmic Power, Cotton Guard, Double Team, Fake Tears, Feather Dance, Noble Roar, Scary Face, Screech, String Shot and Sweet Scent.
- Supported Abilities: none yet.
- Supported items: none yet.

Every unsupported entry currently resolves to `missing-manifest`. As implementation expands, more precise reasons such as `missing-handler:<id>`, `missing-test-evidence` and `invalid-manifest:<problem>` prevent incomplete mechanics from entering a legal build.

## Architecture

`app/mechanics-v3/manifest-contract.mjs` defines the accepted hooks and requires every move manifest to declare priority, target mode, contact behavior, ordered handlers and separate Single/Double test evidence.

`app/mechanics-v3/registry.mjs` executes handlers by explicit order. It clones battle state and payloads, rejects handler input mutation and returns a trace suitable for debugging and replay checks.

`app/mechanics-v3/coverage.mjs` derives support from manifests, registered handlers and test evidence. Support is never inferred from source descriptions or from `availableInChampions`.

`app/mechanics-v3/handlers/spend-pp.mjs` validates and consumes PP before execution. `app/mechanics-v3/handlers/check-accuracy.mjs` gives damage and status moves one seeded accuracy path, combines accuracy/evasion stages and rolls spread targets independently. `app/mechanics-v3/handlers/direct-damage.mjs` consumes the shared accuracy result plus the R2 target/damage contracts, supports immunity and redirection, and emits authoritative damage breakdown events. `app/mechanics-v3/handlers/apply-stat-stages.mjs` applies reviewed self/ally/foe changes, clamps all seven battle stages and emits requested/applied deltas.

`app/mechanics-v3/capability-inventory.mjs` creates a complete research queue for the 516 M-A moves. Description-derived signals are explicitly untrusted and cannot change implementation or legality. Generate it with `npm run mechanics:inventory -- pv-ma-2026-09-11`.

## Initial move evidence

PokéBase supplies the Champions power, type, category, accuracy and PP values. Pokémon Showdown's move data is used as an architecture and mechanics cross-check for fields absent from the PokéBase payload: <https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts>.

The local manifests explicitly record:

- Tackle: priority 0, contact, adjacent foe, direct damage.
- Aerial Ace: priority 0, contact, any adjacent target, always hits, direct damage.
- The first stat-stage batch: seven self-target boosts and two adjacent-ally boosts with explicit stage deltas.

The stat-stage target, priority, boost payloads and three-based accuracy multiplier were cross-checked against Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`. PokéBase remains the Champions candidate source for the displayed move values; Showdown does not override Champions-specific differences such as PP.

Minimize remains blocked even though the generic evasion stage exists. Its named volatile changes accuracy/damage interactions for a separate set of moves, so an evasion-only manifest would be incomplete.

The supporting fixtures cover normal Single damage, Ghost immunity, an adjacent ally target in Double and Double redirection. Neither move has been added to the schema-2 playable catalog; promotion remains part of R4.

## Rebuild coverage

```powershell
cd D:\Mon\AetherChampions\app
npm run mechanics:coverage -- pv-ma-2026-09-11
```

This writes `mechanics-coverage.json` and `mechanics-coverage.md` beside the normalized local candidate. The JSON matrix is the machine-readable source for future legality checks.
