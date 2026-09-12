# R3 Mechanics Coverage — 2026-09-12

## Current state

The M-A candidate contains 862 mechanics-bearing entries: 516 moves, 180 Abilities and 166 items. The coverage generator evaluates every entry independently for Single and Double battles.

The current coverage after completing the protection and redirection R3.5 batch is:

- Single: 79 supported, 783 blocked.
- Double: 79 supported, 783 blocked.
- Supported moves: the previous 73 plus Spiky Shield, King's Shield, Baneful Bunker, Feint, Follow Me and Rage Powder.
- Supported Abilities: none yet.
- Supported items: none yet.

Every unsupported entry currently resolves to `missing-manifest`. As implementation expands, more precise reasons such as `missing-handler:<id>`, `missing-test-evidence` and `invalid-manifest:<problem>` prevent incomplete mechanics from entering a legal build.

## Architecture

`app/mechanics-v3/manifest-contract.mjs` defines the accepted hooks and requires every move manifest to declare priority, target mode, contact behavior, ordered handlers and separate Single/Double test evidence.

`app/mechanics-v3/registry.mjs` executes handlers by explicit order. It clones battle state and payloads, rejects handler input mutation and returns a trace suitable for debugging and replay checks.

`app/mechanics-v3/coverage.mjs` derives support from manifests, registered handlers and test evidence. Support is never inferred from source descriptions or from `availableInChampions`.

`app/mechanics-v3/handlers/spend-pp.mjs` validates and consumes PP before execution. `app/mechanics-v3/handlers/check-accuracy.mjs` gives damage and status moves one seeded accuracy path, combines accuracy/evasion stages and rolls spread targets independently. `app/mechanics-v3/handlers/direct-damage.mjs` consumes the shared accuracy result plus the R2 target/damage contracts, supports immunity and redirection, and emits authoritative damage breakdown events. `app/mechanics-v3/handlers/apply-stat-stages.mjs` applies reviewed self/ally/foe changes, clamps all seven battle stages and emits requested/applied deltas.

`app/mechanics-v3/capability-inventory.mjs` creates a complete research queue for the 516 M-A moves. Description-derived signals are explicitly untrusted and cannot change implementation or legality. Generate it with `npm run mechanics:inventory -- pv-ma-2026-09-11`.

`app/mechanics-v3/major-status.mjs` is a small public facade. State/application, before-action gates and residual processing live in `major-status-state.mjs`, `major-status-action.mjs` and `major-status-residual.mjs`. The handler enforces one major status plus intrinsic and move-specific immunities. Sleep uses a seeded 1–3-turn action block; freeze uses a seeded 20% natural thaw; bad poison escalates from 1/16 to 15/16 max HP and resets its counter on switch-out.

`volatile-state.mjs` owns volatile application and duration state. `volatile-action.mjs` resolves flinch and confusion, while `before-action.mjs` preserves the reviewed sleep/freeze → flinch → confusion → paralysis order. Confusion self-damage uses the source's isolated power-40 formula and does not enter the ordinary damage modifier pipeline.

`move-restrictions.mjs` exposes a command validator for Taunt, Encore and Disable and a resolver fail-safe that runs before PP. `move-history.mjs` records the last move only after execution passes action and PP gates. The turn engine supplies `hasActed` so three/four-turn durations remain correct whether the target has already moved; end-turn cleanup also ends Encore early when its bound move reaches zero PP.

`linked-residual.mjs` resolves source-bound end-turn damage before major statuses. Leech Seed stores a side/slot locator, so a replacement in the source position receives healing. Damage uses one eighth of target max HP and healing uses actual HP lost; unavailable sources suppress both operations. Multiple links use symmetric damage followed by capped aggregate healing.

`damage-hit.mjs` owns one authoritative damage hit and is shared by direct and multi-hit handlers. The multi-hit handler resolves target/accuracy once, samples the modern 2–5 distribution, gives every hit its own crit and damage roll, emits hit-indexed damage plus a `hitCount` summary, and stops on immunity or faint. Recoil and drain handlers consume aggregate actual damage after HP caps; their fractions and rounding match the pinned Showdown implementation.

`fixed-damage.mjs` applies level and current-HP formulas after targeting, accuracy and immunity without ordinary damage modifiers. `variable-power.mjs` resolves HP, effective-Speed, positive-stage and fainted-ally formulas; `variable-power-damage.mjs` then sends that power through the shared hit pipeline and emits `powerResolved`. The shared hit now applies Attack/Defense stages and the reviewed critical-stage bypass rules.

Conditional callbacks reuse the variable-power pipeline for user/target status, poison-only status, target current HP and seeded random doubling. Facade tells the shared hit to ignore burn reduction only while its status boost is active. `apply-stat-stages` can now explicitly target self after a successful damaging handler, allowing Scale Shot to compose multi-hit damage with one post-move Defense drop and Speed boost.

`protection.mjs` owns the shared consecutive-use gate, block resolution and contact retaliation. Protect and Detect create a personal one-turn volatile; Wide Guard and Quick Guard create one-turn side conditions. The shared accuracy handler checks protection before consuming accuracy RNG, filters targets independently, and applies reviewed contact damage, stat or status responses. The `break-protection` handler plus manifest `bypassesProtect` flag let Feint remove personal and side protection before damage without relying on move IDs.

`redirection-state.mjs` applies one-turn redirect state and rejects it when a format has only one active Mon. `rules-v3/redirection.mjs` selects the latest valid redirect for opposing single-target moves and lets Grass attackers bypass Rage Powder. Follow Me and Rage Powder therefore reuse the same target resolution path as damage, status and stage handlers.

## Initial move evidence

PokéBase supplies the Champions power, type, category, accuracy and PP values. Pokémon Showdown's move data is used as an architecture and mechanics cross-check for fields absent from the PokéBase payload: <https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts>.

The local manifests explicitly record:

- Tackle: priority 0, contact, adjacent foe, direct damage.
- Aerial Ace: priority 0, contact, any adjacent target, always hits, direct damage.
- The first stat-stage batch: seven self-target boosts and two adjacent-ally boosts with explicit stage deltas.

The stat-stage target, priority, boost payloads and three-based accuracy multiplier were cross-checked against Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`. PokéBase remains the Champions candidate source for the displayed move values; Showdown does not override Champions-specific differences such as PP.

Minimize remains blocked even though the generic evasion stage exists. Its named volatile changes accuracy/damage interactions for a separate set of moves, so an evasion-only manifest would be incomplete.

Hypnosis, Sing and Sleep Powder apply sleep; Sleep Powder additionally rejects Grass targets. Toxic applies bad poison, rejects Poison/Steel targets and bypasses its accuracy roll for a Poison-type user. These behaviors were cross-checked at the pinned Showdown server commit in `data/conditions.ts`, `data/moves.ts` and `sim/battle-actions.ts`. Rest, Yawn, secondary status chances, Fire-hit thaw and defrost moves remain blocked because they require heal, delayed-status, secondary-effect or damage-interaction handlers.

Confuse Ray, Flatter and Swagger apply confusion. Flatter and Swagger compose their existing stat-stage behavior before volatile application. Their `anyAdjacent` target contract covers ally targeting in Double; foe targeting remains redirectable. Fake Out and other flinch moves remain blocked until damage-secondary chance and first-turn-after-entry requirements have explicit handlers.

Taunt blocks status-category choices, Encore binds the target's last valid move, and Disable blocks that exact last move. All three support `anyAdjacent`; invalid history, exhausted PP, duration expiry, switch cleanup and before-action ordering have positive and negative fixtures. R4 must call the command validator while building legal choices and retain the resolver gate as authoritative fallback.

Leech Seed uses the shared accuracy, targeting and volatile application handlers. Grass immunity, source replacement, unavailable source, low-HP damage, healing cap, multiple Double targets and ordering before poison/burn all have fixtures. Liquid Ooze and Big Root remain unavailable until their own Ability/item manifests are reviewed.

Bullet Seed, Rock Blast and Icicle Spear use the 2–5 distribution; Dual Wingbeat always hits twice. Double-Edge and Brave Bird use 33/100 recoil, Wild Charge uses 1/4 and Head Smash uses 1/2. Giga Drain, Drain Punch and Horn Leech restore 1/2 actual damage; Draining Kiss restores 3/4. Scale Shot, Skill Link, Loaded Dice, Rock Head, Reckless, Liquid Ooze and Big Root remain blocked until their additional handlers have explicit evidence.

Night Shade and Seismic Toss deal level damage; Super Fang removes half current HP. Flail, Reversal, Electro Ball, Gyro Ball, Eruption, Water Spout, Stored Power, Power Trip and Last Respects use explicit variable-power callbacks. Grass Knot, Low Kick, Heat Crash and Heavy Slam remain blocked because the current M-A species snapshot has no canonical weight field.

Facade, Hex, Venoshock, Hard Press and Fickle Beam cover the condition-power formulas available from current battle state. Scale Shot joins the multi-hit group with a damage-gated self stage change. Turn-history moves, secondary-effect combinations and weight-based formulas remain fail-closed with their dependencies documented.

Protect and Detect block external moves for one turn. The first protection attempt succeeds, then uninterrupted attempts use the shared `1/3`, `1/9` sequence with denominator capped at 729; skipping a turn resets the chain. Wide Guard blocks spread moves for the whole side and Quick Guard blocks positive-priority moves for the whole side. Spiky Shield, King's Shield and Baneful Bunker add contact-only damage, Attack reduction and poison; Feint removes these states and side guards before dealing damage. Follow Me and Rage Powder redirect opposing single-target moves only in Double, with latest-use ordering and Grass immunity for Rage Powder. Fixtures cover expiry, PP/RNG order, contact/non-contact, status/type immunity, shield breaking, both allies and redirect selection.

The supporting fixtures cover normal Single damage, Ghost immunity, an adjacent ally target in Double and Double redirection. Neither move has been added to the schema-2 playable catalog; promotion remains part of R4.

## Rebuild coverage

```powershell
cd D:\Mon\AetherChampions\app
npm run mechanics:coverage -- pv-ma-2026-09-11
```

This writes `mechanics-coverage.json` and `mechanics-coverage.md` beside the normalized local candidate. The JSON matrix is the machine-readable source for future legality checks.
