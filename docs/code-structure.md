# Pokémon Vanguard — Code Structure Guide

This document defines the current ownership boundaries used by the active project. It is intentionally short and operational: new code should fit one of these areas instead of growing a cross-cutting utility file.

## Runtime boundaries

- `app/rules-v3/` — deterministic battle rules/state primitives. No browser/UI dependencies.
- `app/mechanics-v3/` — move, Ability and held-item mechanics layered on top of rules-v3.
- `app/server/` — authoritative actions, account/save projection, Ranked orchestration and server-side adapters.
- `app/public/js/` — browser controllers/views/presentation. It must not calculate authoritative battle results.
- `app/content*` — reviewed content snapshots, active catalogs and machine-readable contracts.
- `app/scripts/` — build, validation, audit and asset tooling.
- `app/logic-src/` — source of the generated v2 compatibility engine.
- `app/src/logic.js` and `app/src/v2-engine.mjs` — generated artifacts. Never edit directly.
- `app/server/legacy/` — frozen compatibility/history snapshot. Do not use as a development target.

## Mechanics module conventions

`mechanics-v3/item-hooks.mjs` is a compatibility facade. Implementation is split by responsibility:

- `item-hooks/state.mjs` — held-item identity, reveal/consume, ownership transfer and Berry consumption state.
- `item-hooks/modifiers.mjs` — stat/speed/accuracy/healing/critical/type modifiers and Choice lock.
- `item-hooks/combat.mjs` — hit interception, post-damage, seeds, reactive switching and turn-order item effects.
- `item-hooks/status-lifecycle.mjs` — status/stage cure plus end-turn item/Ability lifecycle.

`mechanics-v3/passive-handler-validation.mjs` is also a dispatcher facade. Handler-specific validation belongs in `mechanics-v3/passive-validation/` rather than extending one giant conditional file.

## UI naming and compatibility

The canonical primitive name is `renderPokemonWindow`. `renderAetherWindow` remains as a compatibility alias for older tests/extensions only. New code should not introduce new `Aether` product naming.

Battle presentation browser events use the `vanguard:` namespace via `public/js/ui/events.js`; use the exported constants instead of repeating event-name strings.

The `.aether-window` CSS class remains a presentation compatibility class for now because it is referenced broadly across the accepted Pixel Era cascade. Rename it only as a dedicated migration with visual regression coverage.

## File-size gate

`npm run structure:validate` is part of `npm run check`. Production JavaScript modules are capped at 360 lines, excluding generated `app/src/`, tests and the frozen legacy snapshot. The limit is a guardrail, not a reason to split cohesive code mechanically: split by responsibility and stable dependency direction.

The B32 CSS contract is declared in `public/cascade-contract.css`; every active stylesheet is classified by `scripts/css-layer-manifest-b32.mjs` and validated by `npm run css:cascade:validate`. The stable order is reset, tokens, base, components, routes, theme and overrides. Keep lazy route CSS lazy, keep `cascade-contract.css` first in every HTML entry, and update the manifest deliberately when adding a stylesheet. `pixel-era-ui.css` remains the theme/resolution-lock layer; changes to it require focused UI tests and browser parity review.

## Contributor entry point (B26)

Use [`../README.md`](../README.md) and [`developer-workflow-b26.md`](developer-workflow-b26.md)
for current install/start/release instructions. Earlier audits describe historical
states, not live command defaults. The generated V2 adapters and frozen V1
compatibility files above remain separate from the active V3 combat rules.

## Reviewed catalog retention / runtime delivery (B27)

`app/content-active/retention-manifest.json` is the review-required immutable catalog ledger.
The runtime resolves only `content-active/active.json`, validated against that ledger;
the standard source archive retains the 34 historical snapshots, while optional
`package:full -- --profile runtime` excludes only those reviewed historical JSONs.
Both profiles are verified by `scripts/verify-release.py`; the default `npm run check`
auto-detects a clean extracted runtime archive using its `RELEASE-MANIFEST.json`.
Consult [`catalog-retention-b27.md`](catalog-retention-b27.md) before promoting a
new catalog or claiming replay support for a previous version.

## B35 ownership map and complexity gate

B35 finishes the high-risk module split in [module-boundaries-b35.md](../app/docs/module-boundaries-b35.md). These are the stable owners when adding features:

- `app/local-server.mjs` composes HTTP, WS, account and lifecycle dependencies. HTTP routing belongs in `server/http-request-handler.mjs`; WebSocket transport/join/broadcast belongs in `server/websocket-controller.mjs`; gameplay command dispatch belongs in `server/player-action-dispatch.mjs`; public serialization belongs in `server/public-state-projector.mjs`.
- `server/ranked-v1.mjs` is the compatibility service facade. Matching, projected views, match transitions/timers, profile/rating and durable pair settlement are separate Ranked modules. Do not move durable settlement back into an action handler.
- `mechanics-v3/manifest-contract.mjs` keeps its original exports. Value enums, handler validation and move-specific validation have distinct ownership.
- `public/client.js` still owns the active DOM shell, event listeners, route/controller lifecycle and battle playback integration. Pure account/mail/settings markup lives in `public/js/client-chrome-views.js`, feature click routing in `public/js/client-feature-action-router.js`, and shell/legacy modal templates in `public/js/client-shell-layout.js` and `public/js/client-modal-templates.js`. Never put authoritative battle mutations in the UI.
- `public/admin.js` owns requests, mutation retries and DOM listeners. `public/js/admin-views.js` produces markup from state and receives no fetch/storage dependency.

Run `npm run module:validate` (included in `npm run check`) for entry-size and split-ownership regression, alongside existing import/cycle, 360-line, lint and TypeScript contract gates. B35 budgets apply to the five former hubs; these are **byte limits in addition to** the existing source-line gate and should not be bypassed by compressing control flow onto one line. Adding a new domain should usually add its own module and focused tests.
