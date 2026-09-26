# R3-100 — M-A Presentation Release Report

## Verdict

**Engineering/runtime status: READY WITH EXPLICIT ASSET DEBT.**

The M-A implementation is now closed at the runtime/presentation-contract level. This does **not** claim that bespoke Pokémon artwork is complete.

## Locked runtime scope

- 213/213 canonical non-Mega M-A selectable entries.
- 59/59 legal M-A Mega forms / relations.
- 272/272 selectable entries total.
- 490/490 active moves resolve a valid presentation timeline.
- 10 signature timelines + 480 parameterized timelines + 0 legacy presentation fallback.
- 490/490 impact timelines contain an authoritative commit marker.
- 277 battle/foundation forms.

## Release matrix

`npm run release:matrix` verifies:

- 213/213 non-Mega species represented in deterministic Single Battle Lab scenarios.
- 213/213 non-Mega species represented in deterministic Double Battle Lab scenarios.
- 59/59 M-A Mega relations can evolve and emit the Mega presentation cue.
- special presentation smoke for Mega, Transform, Illusion break, Disguise break, form change, semi-invulnerable enter/exit, faint and switch-in.
- 490/490 active move presentation definitions remain commit-safe.

## Offline/runtime gate

`npm run release:validate` is included in `npm run check` and verifies:

- exact M-A scope;
- Mega scope;
- Move FX/presentation coverage;
- presentation asset manifest resolution;
- no external HTTP(S) reference in public HTML/CSS/JS/JSON runtime files;
- keyboard release mappings;
- reduced-motion CSS;
- coarse-pointer/touch hardening;
- responsive viewport metadata.

R3-100 removed the remaining Google Fonts network import, so the public package no longer needs Internet access for fonts/assets/audio.

## Asset coverage — intentionally separated from runtime completeness

Current bespoke coverage:

- front sprite: 13/272;
- back sprite: 13/272;
- artwork: 13/272;
- entries with complete bespoke front + back + artwork: 13/272.

The remaining **259/272** entries resolve to a deliberate local placeholder. This prevents broken images and network requests, but it is **not equivalent to bespoke Pokémon art**.

No third-party Pokémon sprite/art pack should be copied into the release until source, license/provenance and redistribution terms are explicitly approved.

## Automated evidence

- `npm run check` ✅
- `npm run release:validate` ✅ (`runtime-ready-with-debt`)
- `npm run release:matrix` ✅
- full regression: **1089/1089** ✅

## Remaining release-quality debt

The primary visible debt is bespoke Pokémon presentation assets. Additional non-blocking polish can continue for more signature move animations, richer local audio and device/browser manual QA, but these should not reopen authoritative battle mechanics.
