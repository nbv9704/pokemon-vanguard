# Pokémon Vanguard — authoritative migration roadmap

Version 1.1 · Source audit 11/09/2026

This document supersedes the original Aether-specific product decisions in `ROADMAP.md`. Completed M0–M4 engineering remains reusable where listed below. The current 36-species catalog is a compatibility fixture until the M-A import gate passes; it must not be presented as canonical Pokémon Champions data.

## Locked product decisions

- Product name: **Pokémon Vanguard**.
- Battle target: reproduce Pokémon Champions mechanics as closely as the available verified data permits.
- Initial playable regulation: **M-A only**. M-B and M-C are later content snapshots.
- Both Single and Double remain first-class formats.
- Training uses 66 Stat Points with a maximum of 32 per stat.
- A species may have one or two types. The canonical 18-type chart replaces the 12-type Aether chart.
- Species can select only moves and Abilities legal for that species in the chosen Champions snapshot.
- Items keep PokéBase's `availableInChampions` value as source metadata, but become battle-legal only after their effects are implemented, tested and allowed by the selected regulation.
- Ascension/Aether Stone is retired. Mega Evolution and the appropriate Mega Stone replace it.
- There is no species rarity system and no rarity-based gacha.
- Recruitment uses banner snapshots. The PokéBase Roster Ranch observed on 11/09/2026 produces ten pulls per Recruit; ten is therefore the target default, while the count remains banner-configurable. The seven-day Trial and permanent coin/ticket purchase remain Pokémon Vanguard progression rules rather than claims derived from PokéBase.
- Pokémon use locally cached Pokémon Showdown front GIFs. The player side flips the same front sprite. Runtime gameplay never fetches remote assets.
- Pokémon keep their idle GIF; move presentation uses move FX, projectile, camera, impact, shake, status, weather and terrain animation.
- Runtime UI copy is English. Data uses stable IDs; display text remains separate from mechanics.
- Old development saves reset roster/build/team when schema 3 is introduced. Wallet and local display settings may be preserved; no one-to-one mapping from the 36 original Mon is created.
- New source snapshots are generated as candidates and require manual review before they become the active catalog.

## Source and snapshot policy

The source manifest is `app/content-src/pokemon-sources.json`. PokéBase pages supply candidate Champions roster, move, Ability, item and Roster Ranch banner data. Pokémon Showdown supplies candidate sprite filenames. Every accepted snapshot records source URL, fetched timestamp, parser version, regulation and a content hash. The detailed audit is in `docs/source-audit-2026-09-11.md`.

Import scripts write only to `app/content-candidates/<snapshot>/`. They never overwrite `app/content/`. A separate promote command validates the candidate, prints a semantic diff and requires an explicit snapshot ID. The game reads checked-in local JSON and local sprites only.

Data precedence for conflicts:

1. Pokémon Champions behavior observed in the target build.
2. The accepted PokéBase Champions snapshot.
3. Main-series mechanics only when Champions-specific data is absent, recorded as an explicit fallback.
4. A project-specific temporary value marked `provisional: true`; provisional entries are illegal in Ranked.

PokéBase usage percentages, common builds and season analytics are never legality inputs. Species/form records, their move and Ability relations, form-specific regulation tags and item availability are the candidate content inputs. Text descriptions are documentation inputs only; they are not executable mechanics.

## Reusable work and retired assumptions

Reusable: deterministic phase engine, Single/Double command flow, server authority, PP, target selection, event projection, animation queue, AI boundary, build/team IDs, atomic JSON storage, migration backup, reward receipts, economy ledger, monotonic clock, Trial references, Damage Inspector and simulations.

Retired: original species/type/move/Ability/item catalog as production content, rarity, summon pity, Celestial Call UI, Ascension naming, Alpha/Beta regulation names and Aether-specific balance conclusions. Frozen v1 code remains only for finishing old battles and migration tests.

## Target content contracts

`species.json` entries require `id`, `sourceSlug`, `dexNumber`, `formId`, English name, one or two canonical types, six base stats, Champions regulation sets, legal move IDs, legal Ability IDs, supported item restrictions, sprite key and default build. `sourceSlug`, rather than display name or Pokédex number, identifies a PokéBase form. Rarity and legacy art IDs are forbidden in schema 3 production data.

`moves.json` entries require category, type, power, accuracy, PP, priority, target mode, contact flag and an ordered effect list. Every effect uses a registered engine handler. Unsupported effects remain catalogued with `implemented:false` and make the move illegal.

`abilities.json` and `items.json` use hooks rather than species-specific conditionals. Each entry declares supported formats, trigger timing, visibility and implementation status. Items separately store `availableInChampions`, unlock metadata, regulation legality and implementation status. Mega relations declare base species, Mega species, Mega Stone and regulation sets; the Mega form owns its changed type/stats/Ability and sprite.

Regulations use IDs such as `m-a-single` and `m-a-double`, pin a catalog snapshot, and declare roster size, pick count, level, clauses, allowed species/forms/items and Mega rules. The current `alpha-*` IDs remain compatibility fixtures until replacement.

## Delivery sequence

This order is authoritative: **R0 Rebaseline → R1 M-A Data → R2 Battle Rules → R3 Mechanics Coverage → R4 Training/Team UI → R5 Roster Ranch → R6 Mega Evolution → R7 Sprite/Move FX → M6 PvP → M7 Ranked**. A later stage may be prototyped, but it cannot become the active production path before the previous gate passes.

### R0 — Rebaseline

Status: complete.

- Lock the Pokémon Vanguard name, English runtime copy, local-first operation and no-rarity direction.
- Preserve reusable deterministic battle, persistence, ledger, Trial reference and animation-queue work. Treat the existing 36 Mon and 12 types as compatibility fixtures.
- Define schema 3 IDs, source precedence, snapshot/promotion rules and save migration boundaries.
- Keep the legacy battle path only long enough to finish already-started battles and exercise migration fixtures.

Gate: roadmap, source audit and data contracts agree; the compatibility build passes checks without modifying player saves.

### R1 — M-A Data

Status: importer complete; local candidate `pv-ma-2026-09-11` passes validation with 213 species/forms, 516 referenced moves, 180 referenced Abilities, 166 items, five banners and zero unresolved references. Manual review and promotion remain pending.

- Fetch immutable raw snapshots with exact URL, timestamp, HTTP metadata, byte length and SHA-256. Refuse same-ID replacement.
- Parse fixture-backed Next/RSC data offline, resolve form references by source slug and retain upstream IDs.
- Produce species, move, Ability, item and banner candidates plus provenance, unresolved and human review reports.
- Preserve M-B/M-C membership for later snapshots without activating it. Keep usage analytics separate from legality.
- Validate all references, the 18-type vocabulary, one/two-type shape, six base stats and byte-identical rebuilds.
- Add a reviewed-snapshot promotion command only when the schema-3 runtime contract is ready; promotion must never be an implicit result of fetch/build.

Gate: a pinned reviewed snapshot validates offline and produces byte-identical normalized JSON. Runtime still uses compatibility content until R2–R4 can consume the new contract safely.

### R2 — Battle Rules

Status: complete as an isolated shadow contract. It covers 18 types, level-50 stats, 66/32 Stat Points, all natures, the common damage core, Single/Double targets, redirection, switch → Mega → move timing, dynamic speed, faint cancellation, replacement, end-turn groups and seeded replay equality. Schema-2 remains the playable compatibility path; R3 supplies mechanic handlers and R4 performs catalog/runtime promotion.

- Replace the compatibility chart with all 18 canonical types and golden tests for immunity, ¼×, ½×, 1×, 2× and 4× dual-type cases.
- Verify level-50 stat and damage formulas, 66 total Stat Points, 32 per-stat cap, nature modifiers, STAB, random roll, critical hit and burn behavior against Champions examples.
- Specify the authoritative turn order: replacements, switching, Mega timing, move priority, speed, Trick Room, deterministic ties, action cancellation, fainting and end-of-turn groups.
- Specify Single and Double target sets, ally targets, adjacency assumptions, spread reduction, redirection and replacement rules.
- Version `rulesVersion` independently from `catalogVersion`; a battle snapshots both at preview lock.
- Expose the exact pure damage breakdown to the Damage Inspector. Animation and UI never calculate battle results.

Gate: golden Single/Double fixtures pass and the same seed plus command stream produces the same state, events and replay.

Implementation reference: `docs/r2-battle-rules-reference-2026-09-12.md`.

### R3 — Mechanics Coverage

- Build ordered hook registries for moves, Abilities and items instead of species-specific conditionals.
- Implement mechanics in families: direct/status damage; stage changes; accuracy/evasion; priority; multi-hit; recoil/drain; Protect/guards; status and volatile conditions; switching/pivot/trap; redirection; weather/terrain/rooms; hazards; item consume/loss/swap; Ability suppression/copy; delayed and end-turn effects.
- Give every imported entry a capability manifest and `implemented` state. Descriptions remain documentation, never executable logic.
- Generate a coverage matrix for M-A showing supported Single, supported Double, blocked reason, handlers and tests.
- Allow a move, Ability or item into a legal build only when every required handler passes positive, negative, interaction and replay tests.

Gate: every enabled M-A entry is correct in both formats; every remaining entry is excluded with a machine-readable reason. No provisional mechanic enters competitive rules.

### R4 — Training and Team UI

- Promote the reviewed M-A catalog and make Archive, Training, Damage Inspector, Team Builder, Preview and AI read the same versioned contract.
- Support one/two-type display, legal learnsets, legal Abilities/items, nature selection and the 66/32 Stat Point editor with server validation.
- Show mechanic support and regulation errors before save. Import/export blueprints may reference content but never grant ownership or currency.
- Run schema-3 migration: back up schema 2, preserve suitable wallet/settings/mail/tutorial data, archive legacy roster/build/team IDs and create fresh M-A legal records.
- Keep migration idempotent and defer it while an old battle result still needs acknowledgement.

Gate: a user can create a legal build and team, restart locally, lock Team Preview and finish Single/Double battles using only promoted M-A IDs.

### R5 — Roster Ranch

- Import dated banner snapshots with pool, active interval, kind and banner-configurable pull count. The current observed default is ten pulls.
- Verify duplicate, shiny, mark, ball and coupon rules before implementing them; do not infer probabilities from descriptions or one observed pull.
- Keep Vanguard progression rules explicit: one server-timed seven-day Trial and permanent recruitment by coin or ticket.
- Preserve the same Pokémon/build/team IDs when Trial becomes permanent. Expiry blocks future preview locks and never mutates an already-locked battle.
- Remove the eight-offer compatibility UI and simulation only after the banner-backed path passes migration and economy tests.

Gate: banner → Trial → team → preview → battle → expiry → permanent upgrade remains consistent and idempotent across restart.

### R6 — Mega Evolution

- Normalize `{baseSpeciesId, megaSpeciesId, itemId, regulationSets}` and verify legality from the Mega form plus stone in the selected snapshot.
- Allow the verified number of Mega uses per side; validate command timing and all item/species/regulation constraints server-side.
- Preserve HP, PP, status, stages, volatiles and switch persistence exactly as confirmed by fixtures, then swap form stats, type, Ability and sprite.
- Emit explicit transformation events suitable for replay and animation without exposing hidden information.

Gate: Single/Double fixtures cover valid transformation, duplicate attempts, switch persistence, suppression, fainting, replay and save recovery.

### R7 — Sprite and Move FX

- Cache Showdown animated front Pokémon GIFs locally using an explicit source-slug alias manifest. Flip the player-side front sprite. The Pokémon remains on its idle GIF while attacking; move presentation is rendered on independent FX layers.
- Audit base and Mega sprite coverage, GIF signatures, dimensions, hashes and asset budgets. Never silently substitute the wrong form.
- Build original Vanguard FX as small primitives, reusable profiles and sparse move overrides. Use the Showdown architecture as a behavior reference; do not copy its large animation tables or assume its `/sprites` and `/audio` resources are in the repository.
- Drive FX only from authoritative battle events. Projectiles, beams, waves, contact marks, field overlays, status cues, camera/slot shake, numbers and timing may animate; they never change HP or rules.
- Use explicit Single/Double actor/target anchors, behind/front/field layers and parallel target tracks for spread moves.
- Split primitives, timeline runner, profiles and move overrides into cohesive modules. Avoid a monolithic per-move animation file.
- Provide type/category fallback profiles, Skip, playback speed, preload, cancellation and reduced-motion behavior. Missing FX must degrade to a readable cue without blocking battle progress.

Detailed reference: `docs/showdown-animation-reference-2026-09-12.md`.

Gate: every enabled move resolves to a tested profile or override; representative moves pass visual QA in Single/Double, desktop/mobile, normal/reduced motion and offline mode.

### M6 — PvP

- Add private room creation/join, reconnect, spectator projection and version negotiation on top of the authoritative server action path.
- Hide choices, unrevealed builds and private HP data through `viewFor`; never trust client timing, targets or results.
- Snapshot regulation/catalog/rules for the room, persist command receipts and support deterministic replay plus reconnect after process restart.
- Add disconnect grace, surrender, draw and abandoned-room rules without real-time tick dependence where avoidable.

Gate: two browsers can complete Single and Double matches through disconnect/reconnect with identical state; spectators cannot act or inspect hidden information.

### M7 — Ranked

- Add authenticated identity, queue/matchmaking, season-pinned regulation, rating updates, result receipts and anti-duplicate settlement.
- Require complete mechanics coverage for the ranked regulation. Reject provisional content, mismatched versions and modified clients at authoritative validation boundaries.
- Record privacy-safe audit/replay data, moderation hooks, queue health and rollback procedures.
- Run load, abuse, disconnect, stale-version and season-transition tests before enabling public ranking.

Gate: rating and rewards settle once from an authoritative completed match; season rules are reproducible and rollback-safe.

## Required checks per ticket

Run `npm run check`, the ticket tests, then `npm test`. Content imports also run offline reproducibility and reference checks. UI tickets require a real local browser pass with console inspection. Simulation uses generated fixtures and never reads or writes `.local-data`.

No ticket is complete when only the button or catalog row exists. It must include authoritative validation, persistence/restart behavior, privacy projection, error UX and relevant tests.
