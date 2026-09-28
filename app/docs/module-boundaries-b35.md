# B35 — Module ownership, public facade compatibility and regression checks

**Target:** optimization item #24 in `docs/project-optimization-audit-2026-09-26.md`.
**Baseline:** B32 (`ea7322f`) plus incremental B33 corrected and B34 patches. This document describes the B35 delta only.

## Extracted responsibilities

| Former hub | Stable entrypoint / facade | New B35 owner | Responsibility preserved |
| --- | --- | --- | --- |
| `local-server.mjs` | `createLocalServer` | `server/websocket-controller.mjs` | upgrade origin/session/IP limits, socket joins, heartbeat, bounded sends, broadcast, close |
| `local-server.mjs` | `createLocalServer` | `server/player-action-dispatch.mjs` | ranked/social/friendly commands and all gameplay writes under existing account locks |
| `server/ranked-v1.mjs` | `RankedService`, public profile exports | `server/ranked-profile.mjs` | ranked season, tier, rating and profile mutation |
| same | same | `server/ranked-matchmaking.mjs` | matching window and opponent selection |
| same | same | `server/ranked-view-projection.mjs` | user and admin Ranked views, including recovery receipt projection |
| same | same | `server/ranked-match-transitions.mjs` | battle creation, forfeits/no-contest and decision timeout transitions |
| same | same | `server/ranked-settlement-service.mjs` | durable pair receipts, atomic pair save and lost-ACK replay |
| `mechanics-v3/manifest-contract.mjs` | `validateMechanicManifest`, named constant exports | `manifest-values.mjs`, `manifest-handler-validation.mjs`, `manifest-move-validation.mjs` | enums, handler-specific validation and move-specific rules |
| `public/client.js` | browser bootstrap and DOM lifecycle | `public/js/client-chrome-views.js` | escaped account/menu, mailbox and Settings markup |
| same | same | `public/js/client-feature-action-router.js` | feature-controller click routing; shell navigation remains bootstrap-owned |
| same | same | `public/js/client-shell-layout.js`, `public/js/client-modal-templates.js` | page selection, shell HTML and pure legacy modal templates; focus and playback still controlled by the shell |
| `public/admin.js` | admin data flow and DOM listeners | `public/js/admin-views.js` | pure admin markup, including Gift Center and live operations |

The B33 HTTP router (`server/http-request-handler.mjs`) and allowlist projector (`server/public-state-projector.mjs`) remain in their existing modules. New B35 dispatcher and WS controller do not establish new global singleton state; the composition root injects per-server services and closes the controller's sockets on shutdown. Ranked's existing public methods remain callable through the facade and delegate with the same `this` context; rating and settlement exports remain unchanged. UI browser entrypoints and HTML script URLs remain unchanged.

## Gates and acceptance

`npm run module:validate` is added to `npm run check` to prohibit moving HTTP, WS transport, ranked domain operations or large admin templates back into the former hubs. This supplements rather than replaces `check:imports` (layer/cycle), `structure:validate` (360 lines), lint and typed contracts. Hub budgets are measured in *bytes* rather than source lines: server root 17 kB, Ranked facade 17 kB, manifest facade 3 kB, client shell 59 kB, admin shell 15 kB. Existing generated/frozen data exceptions remain unchanged; no new directory-wide exemptions.

New characterization tests exercise escaped player/admin markup, mailbox claim routes, settings, async social dispatch, route shell and modal templates, Ranked queue/surrender action IDs, split manifest validation order and public Ranked facade parity. Existing Ranked, recovery, PvP, HTTP, WS, Admin and browser/client test suites protect the more involved transport/action paths. Local acceptance: `npm run check` PASS (including 45 module assertions); B33–B35 focused tests 27/27 PASS; `PV_TEST_BATCH_SIZE=6 npm test` 1,467/1,467 PASS across all 234 runnable Node test files (39 independently verified batches), zero failures/skips/TODO. Three retired TypeScript Cloud tests remain archived. `git diff --check` PASS. No hosted CI run or GitHub push was performed in this environment.

## Follow-up without falsely blocking #24

This batch closes the *accepted high-risk entrypoint/domain responsibility split* for #24. It does not claim every legacy conditional is small, that all active UI views have `mount/update/unmount`, or that a project-wide mechanical formatter migration has been performed; those changes are separate lower-risk hygiene/future UX work and must be independently tested if chosen. Source remains compact in places; new maintainers should follow the extracted responsibility map instead of extending single-line branches. Browser/assistive technology QA and artwork permissions are still **#22/#31 IN PROGRESS**. Supabase live multi-process recovery belongs to #02/#04/#05/#10/#11, not #24.

No new staged database changes, new external asset downloads, GitHub push or hosted CI claim are part of this patch.
