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

### PV-00 — Direction and M4 correction

Status: implemented in the current changeset.

- Rename runtime/product metadata to Pokémon Vanguard.
- Change build validation and Training controls to 66 total / 32 per stat.
- Keep ledger, clock and Trial reference behavior.
- Replace rarity summon with the initial eight-offer Recruitment prototype, seven-day Trial, uniform coin price and ticket payment. PV-05 migrates this prototype to the audited ten-pull banner contract.
- Block legacy `summon` actions after schema v2 migration.
- Replace rarity-pull simulation with equal-pool recruitment simulation.
- Record sources and prevent the transition UI from claiming the old catalog is M-A.

Gate: content check, targeted migration/economy/recruitment tests and the full regression suite pass; old saves are not modified during tests.

### PV-01 — Candidate importer for M-A

1. Fetch Pokémon, moves, Abilities and items into immutable raw snapshots with URL, timestamp and SHA-256.
2. Parse page data using fixture-backed parsers. Network calls are excluded from tests.
3. Normalize names to stable IDs and retain upstream IDs for traceability.
4. Resolve every species-to-move/Ability reference by form slug and report missing or ambiguous forms.
5. Filter only Regulation M-A for the first candidate. Preserve M-B/M-C tags without activating them.
6. Emit candidate JSON plus `provenance.json`, `unresolved.json` and a human-readable diff.
7. Promote only a candidate with zero unresolved required references and a recorded manual review.
8. Keep usage analytics in a separate optional dataset; never merge them into legality or canonical build data.

Gate: a clean checkout can validate the pinned candidate offline; repeating import from the same raw snapshot is byte-identical.

### PV-02 — Canonical mechanics foundation

- Replace the type registry and chart with all 18 canonical types; add dual-type golden tests including immunities and 4×/¼× cases.
- Confirm level-50 stat and damage formulas against Champions examples. Keep calculations pure and expose the same breakdown to Damage Inspector.
- Add ordered hooks for priority, accuracy/evasion, critical hits, multi-hit, recoil, drain, Protect families, switching, redirection, spread reduction, Trick Room, weather and terrain.
- Encode mechanics by reusable effect IDs. A move, item or Ability becomes legal only when all its required handlers pass positive and negative tests.
- Version rules and catalog independently; battles snapshot both at preview lock.

Gate: golden mechanic fixtures pass for Single and Double, and unsupported content cannot enter a legal team.

### PV-03 — Schema 3 roster reset

- Back up schema 2 saves before migration.
- Preserve owner, wallet balances, recruitment tickets, claimed mail, settings identity and completed tutorial markers that remain meaningful.
- Archive old roster/build/team IDs in the migration receipt, then create the M-A starter roster and fresh legal builds/teams.
- Drop pity/summon counters from active state while retaining them only in the backup receipt for audit.
- Migration is idempotent and defers an active legacy battle until its result is acknowledged.

Gate: fixture saves cover empty, normal, active-battle, expired-Trial and corrupted-reference cases; no original Mon is silently mapped to a Pokémon.

### PV-04 — Local sprite pipeline

- Generate a sprite manifest from accepted species/form IDs and an explicit PokéBase-slug-to-Showdown-filename mapping. Seed the audited M-A aliases and produce a separate Mega coverage report.
- Download to a staging directory, verify GIF signature, size limits, dimensions and SHA-256, then promote to `public/assets/pokemon/`.
- Record missing/form fallback sprites. Never silently use the wrong form.
- Render variable-size GIFs inside a fixed stage box, fit them without cropping and align their feet to a shared baseline. Render opponent front sprites normally and player sprites with CSS horizontal flip. Respect reduced motion by freezing or replacing animation.
- Remove legacy SVG runtime dependencies only after every active M-A entry has a local asset.

Gate: offline browser QA displays every active form from both sides with zero network requests.

### PV-05 — M-A team authoring and Recruitment

- Archive, Training, Damage Inspector and Team Builder read the promoted M-A catalog.
- Recruitment reads an immutable banner snapshot with active dates, pool, pull count and selection rules. The initial audited default draws ten species per Recruit. Whether duplicates are allowed and the exact shiny/mark/ball/coupon rates remain unverified and must not be invented.
- One active seven-day Trial uses server time and a read-only sample build. Expiry blocks new preview locks but never revokes a battle snapshot.
- Permanent recruitment accepts either the configured coin cost or one ticket and upgrades the same Mon/build/team references.
- Remove all rarity labels, filters, prices and pity UI.

Gate: Trial → team → preview lock → expiry during battle → result → permanent upgrade retains exact IDs across restart.

### PV-06 — Mega Evolution

- Model each Mega form as a form record tied to its base species and Mega Stone. Check legality from the Mega form's own regulation sets; the existence of a base record's `megaVariants` link is insufficient.
- Add one Mega command flag per side per battle, validate Stone/species/regulation, and resolve transformation at the verified Champions timing.
- Preserve current HP ratio or exact HP according to verified behavior, plus PP, status, stages and volatile rules documented by fixtures.
- Swap type, stats, Ability and sprite from the form snapshot. Emit explicit transformation events for animation and replay.

Gate: Single and Double tests cover legal use, duplicate attempts, switch persistence, suppression, fainting and replay projection.

### PV-07 — Move FX and English UI

- Map moves to reusable animation profiles: contact, projectile, beam, wave, ground, weather, terrain, buff, debuff, heal and transform.
- Profiles consume authoritative events; Skip and 2× never change state.
- Add per-move overrides only when a generic profile cannot communicate the mechanic.
- Finish English copy for all screens, errors, descriptions and accessibility labels.

Gate: representative moves for every profile pass visual QA in Single/Double, normal/reduced motion and desktop/mobile layouts.

### PV-08 — Competitive hardening

- Complete Double-specific targeting such as ally targets, Follow Me-style redirection, spread moves and simultaneous end-of-turn groups.
- Generate legal AI teams from the active regulation and prevent AI access to hidden opponent data.
- Run deterministic matchup simulation, then human playtests. Bot results flag candidates but never directly change balance data.
- Add replay fixtures, catalog semantic diffs and save recovery drills to release checks.

Gate: all M-A legal content is either implemented and usable or explicitly excluded with a reason; no provisional mechanic appears in competitive play.

## Required checks per ticket

Run `npm run check`, the ticket tests, then `npm test`. Content imports also run offline reproducibility and reference checks. UI tickets require a real local browser pass with console inspection. Simulation uses generated fixtures and never reads or writes `.local-data`.

No ticket is complete when only the button or catalog row exists. It must include authoritative validation, persistence/restart behavior, privacy projection, error UX and relevant tests.
