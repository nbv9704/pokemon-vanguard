# Pokémon Vanguard source audit — 11/09/2026

This audit records what the URLs in `AetherChampions_M4_modified_files/info.txt` actually provide and how they may be used. It is a design and ingestion reference; no scraped catalog in this audit is runtime data.

## Executive findings

- PokéBase is suitable as a candidate source for species/forms, base stats, types, regulation membership, learnset relations, Ability relations, items, Mega relations and Roster Ranch banner pools.
- PokéBase descriptions do not provide a complete executable specification for moves, Abilities or items. Priority, targeting, contact, timing, event ordering and effect handlers need an explicit mechanics registry backed by fixtures.
- The filtered Pokémon pages contained 213 M-A forms, 23 M-B forms and 29 M-C forms. Their combined union contained 261 forms, so regulation sets overlap and must be stored as arrays.
- The source payload contained 937 moves, 314 Abilities and 166 items. All 166 items were marked `availableInChampions`; that flag does not prove the local engine implements their effects.
- The Roster Ranch simulator produced 10 results from one Recruit on the audited date. The earlier eight-offer design remains a prototype behavior and must migrate to a banner-configured pull count.
- Pokémon Showdown listed 1,686 animated front GIF filenames. The 213 M-A base forms had complete coverage after nine explicit aliases. Mega coverage still requires a separate audit.

## Source roles and limits

### Pokémon and forms

Use the PokéBase `slug` as the upstream form key. A display name and national number are not unique enough because regional, gender, breed, stance and other forms are separate records. Each normalized record should retain:

- internal stable `id` owned by Pokémon Vanguard;
- `sourceSlug` and upstream database ID for traceability;
- national number and English display name;
- one or two types and six base stats;
- `regulationSets[]`;
- move and Ability relations;
- base/Mega relations where present.

M-A had 213 visible non-Mega form records over three pages. M-B had 23 and M-C had 29. The combined filter returned 261, confirming that summing per-set counts would double-count overlapping forms.

Species detail pages also contain current-season usage, common Stat Point spreads, natures and team analytics. Those values are descriptive metagame data. They must be stored separately, if imported at all, and must never determine legality.

### Moves

The source move records expose name, slug, type, damage class, optional power, optional accuracy, PP and a description. The audited payload did not expose reliable structured fields for priority, target mode, contact or an executable effect definition.

The importer may normalize the descriptive fields, but it must never parse prose into trusted mechanics. A local registry keyed by move slug must supply capabilities and ordered handlers such as damage, stage changes, recoil, drain, multi-hit, priority, Protect, switching, redirection, spread damage, weather, terrain and delayed effects. A move remains `implemented:false` until every required handler has positive and negative tests in all supported formats.

The live Moves page showed a client error during part of the audit while its server-rendered payload remained downloadable. Imports should therefore fetch and hash immutable HTTP snapshots, parse fixture copies offline and avoid browser-DOM scraping as the primary pipeline.

### Abilities

The source contained 314 Ability records: 262 normal entries and 52 marked `isMegaAbility:true`. Records expose a slug, English description and that classification. Trigger timing and engine operations remain prose.

`isMegaAbility` is metadata, not proof of regulation legality or implementation. Each supported Ability needs a local handler manifest describing triggers, ordering, visibility, Single/Double support and tests.

### Items

The source contained 166 items in three categories: 28 Berries, 57 held items and 81 Mega Evolution items. Records include slug, description, icon, category, unlock metadata and `availableInChampions`. Every audited record had `availableInChampions:true`.

Keep these concepts separate:

- `availableInChampions`: upstream availability;
- `legalByRegulation`: whether the selected ruleset allows the item;
- `implemented`: whether the local effect is complete and tested;
- `enabledForBattle`: derived from availability, regulation legality and implementation.

Unlock strings such as `beginning` or `shop-700-vp` are source economy metadata. They must not silently become Pokémon Vanguard coin prices; any conversion belongs to a versioned economy configuration.

### Mega Evolution

Base records can link to `megaVariants`, including a stone, target stats and types. Mega forms also exist as their own records with form-specific types, stats, Ability and regulation sets.

Normalize a Mega relation as `{baseSpeciesId, megaSpeciesId, itemId, regulationSets}`. Determine availability from the Mega form and stone in the selected snapshot. Do not activate a Mega merely because the base form has a `megaVariants` link.

### Roster Ranch

The audited simulator exposed dated banner records, including Regular Roster M-A, M-B and M-C plus special banners. Each banner has its own pool and active interval. One Recruit produced ten visible results and changed counters from 0 to 1 Summon and 10 Pulls.

Model recruitment as a banner snapshot with `id`, `sourceSlug`, `startAt`, `endAt`, `poolSpeciesIds`, `pullCount` and explicit rules. Ten is the observed default. Duplicate rules and rates for Coupons, shiny variants, marks and special balls were not verified, so the implementation must not infer them from a single pull.

The seven-day Trial and permanent coin/ticket choice in Pokémon Vanguard are retained product rules. They are not facts established by this simulator and should live in the local progression configuration.

### Animated sprites

The Showdown directory exposed 1,686 unique front GIF filenames. An exact filename comparison covered 204 of 213 M-A base forms. These nine explicit aliases completed base-form coverage:

| PokéBase slug | Showdown filename |
| --- | --- |
| `aegislash-shield` | `aegislash` |
| `basculegion-female` | `basculegion-f` |
| `kommo-o` | `kommoo` |
| `lycanroc-midday` | `lycanroc` |
| `meowstic-female` | `meowstic-f` |
| `mr-rime` | `mrrime` |
| `tauros-paldea` | `tauros-paldeacombat` |
| `tauros-paldea-aqua-breed` | `tauros-paldeaaqua` |
| `tauros-paldea-blaze-breed` | `tauros-paldeablaze` |

Never derive a Showdown filename solely by replacing punctuation in a PokéBase slug. Store an explicit alias manifest, reject missing mappings and audit Mega filenames independently.

Sample GIFs ranged from 52×87 to 146×81 pixels and from 40 to 119 frames. Battle layout should use a fixed visual box, `object-fit: contain` behavior and a common feet baseline. The opponent uses the front GIF; the player uses the same local asset flipped horizontally. Runtime must preload only the battle roster and must not fetch Showdown.

## Candidate snapshot contract

Every fetch writes a raw immutable file and a manifest containing:

- exact source URL and source kind;
- UTC `fetchedAt`;
- HTTP status and available `Last-Modified`/ETag headers;
- byte length and SHA-256;
- parser name and version;
- target regulation and page/filter parameters.

Parsing produces candidates only. Promotion requires zero unresolved required references, full source/form/sprite reports, a mechanics-support report, a semantic diff from the active catalog and a human-reviewed snapshot ID. Re-running the parser against the same raw files must produce byte-identical candidate JSON.

## Implementation order derived from the audit

1. Build immutable HTTP snapshot and fixture-backed parser infrastructure.
2. Import M-A forms and their direct move/Ability relations using form slugs.
3. Import items and Mega relations while keeping implementation and legality disabled by default.
4. Add the 18-type chart and mechanic-handler registry; enable content incrementally as handlers pass tests.
5. Generate the local sprite manifest with the nine M-A aliases, then audit Mega coverage.
6. Import dated Roster Ranch banners and migrate Recruitment from eight prototype offers to the audited ten-pull default.
7. Promote the first M-A snapshot only after offline reproducibility, reference, legality and battle-format gates pass.

## Audit snapshot fingerprints

These hashes identify the responses inspected on 11/09/2026. They are evidence for this audit, not pinned production artifacts:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| Pokémon | 5,169,551 | `6ab51df3a646ae86c29fdbe233275a41b19f679662aa8d3290e0e7c8ecc48a19` |
| Moves | 674,685 | `e294755045a4d9ef2ab1db4f35b0ec3ab7f6a73ed8f572600795f3cfc734b62e` |
| Abilities | 282,818 | `bf74480f6a3ad15f90f670454ab1dc658d7407a011cb1c1219bc4feeb73150bd` |
| Items | 376,350 | `698cf2b59981a32271f44bc2013fd605e0f77c4154537d15e3d4a2f284be3c0a` |
| Roster Ranch | 793,700 | `25695b976fb242ec1452174d8095a29dae3117e1446cd16efc03a5cb6b93ad49` |
| Showdown sprite listing | 445,755 | `62cc8c08a159d65de56e427a28429bc858dc38e4bdad0cbbaf9d2924b09b6cec` |

The Pokémon and Moves responses supplied `Last-Modified` values during this audit; the other inspected responses did not. The future snapshot command must record missing headers as `null`, never as an empty trusted value.
