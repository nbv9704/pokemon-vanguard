# B37 — UX, accessibility and storage fallback completion

Date: 29/09/2026

## Outcome

Roadmap item #31 is complete for the shipped game and Admin surfaces. The browser UI now has a durable keyboard/focus contract, accessible route and status semantics, reduced-motion/forced-colour coverage, and a persistent explanation when browser storage is unavailable.

## Implemented contract

- Every game shell, including immersive battle, exposes a skip link and a focusable `main` landmark. Admin has the equivalent `#admin-main` target.
- Route changes update the document title and move focus to the new main landmark exactly once. WebSocket redraws of the same route do not steal focus.
- Active game/Admin navigation exposes `aria-current`; Admin detail tabs expose tablist/tab/selected semantics and support Left, Right, Home and End keys.
- The account menu supports Up, Down, Home, End, Escape and Tab. Escape returns focus to its trigger; focus leaving the menu closes it.
- Connection/toast status is announced politely and notification badges have contextual accessible names.
- Modal focus remains trapped, the background remains inert, and the invoking control receives focus on close through the existing `ModalFocusManager` contract.
- A blocked `localStorage` getter/read/write continues in memory, while both the global shell and Settings disclose that local identity/preferences will reset after reload. Server-side authenticated adventure saves are not described as lost.
- Game and Admin styles include visible keyboard focus, skip-link presentation, reduced-motion safeguards and forced-colour selected-state boundaries.

## Regression protection

- `npm run accessibility:validate` checks the required semantics across nine production sources and is part of `npm run check`.
- `tests/accessibility-completion-b37.test.mjs` locks route focus without redraw focus theft, menu keyboard behavior, shell landmarks/live/current semantics, storage disclosure and validator failure behavior.
- Existing module/store/modal tests remain authoritative for HTML escaping, storage failure, inert background, Tab trapping and return focus.

## Scope boundary

This closes the actionable source/runtime contract in #31. It does not claim certification by a third-party accessibility auditor or compatibility with every assistive-technology/browser combination. Future UI features must satisfy the new automated gate and be included in normal browser regression.
