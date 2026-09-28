# B33 — Split server composition / handle restricted browser storage

Date: 28/09/2026. Based on B32 (`ea7322f`). Changes to source only; no player saves, secrets, migrations, mechanics, prices, or catalog content are touched.

## Scope and review

**#24 — IN PROGRESS.** `app/local-server.mjs` remains the composition root. HTTP dispatch is now in `server/http-request-handler.mjs` (dependency-injected auth/admin/proxy, health, inspector, catalog and static ordering). Public player projection is now in `server/public-state-projector.mjs` (legacy root allowlist followed only by explicitly reviewed V2/V3 feature DTOs). Both are called from the original WebSocket/HTTP entry points; the spectator branch remains a minimal `spectator` DTO. The existing audience-based broadcast serialization and metrics are unchanged. Tests that read the old source location now assert wiring **and** the new owner module rather than dropping the checks.

The HTTP boundary additionally aborts a partially written response when a downstream handler throws after headers were sent, instead of attempting a second `writeHead` or silently completing a false-success response. Errors before headers are still mapped to the historical generic 400/404/413 response; health and inspector remain `no-store`, and the inspector 32-KiB body bound and quota ordering remain intact.

**#31 — IN PROGRESS.** Browser startup now resolves the `window.localStorage` *property* inside a `try/catch` before passing it to the existing resilient browser store. Previously, the store handled throwing `getItem`/`setItem`, but `client.js` accessed the property before entering those guards. The default local identity/settings and `aether-*` keys are unchanged. In restricted environments identity/settings are session-memory only and the existing non-persistence toast still applies.

**#22 — IN PROGRESS, browser QA not certified.** The existing isolated responsive-image browser harness now surfaces CDP navigation failures immediately and includes a safe diagnostic of the synthetic gallery if it fails to load. The local headless Chromium attempt failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR` on the loopback gallery even with proxy disabled. This is an environment/browser-policy blocker, **not** proof that the image variants are visually correct or that production browsers fail. Full route/keyboard/screen-reader QA and artwork rights remain outstanding. The static B25 validation is unchanged.

## Verification

- New isolated composition tests cover HTTP precedence, health HEAD/ready/closing, size limits, rate limits, post-header failure, owner/spectator projection and private-state sentinel.
- `tests/client-modules.test.mjs` covers a throwing `localStorage` *getter* and the original `getItem`/`setItem` fallback cases.
- Refactor-aware source tests retain assertive checks for allowlist projection and pre-queue quota wiring.
- `npm run check` passed, including strict lint, type contracts, import boundaries (0 cycles), snapshot/asset/cascade/release gates.
- Focused 16-file integration and regression run: **58/58 PASS**, including real WebSocket projection, account/auth/session, social/admin receipts, HTTP Brotli/cache/Origin, room capacity, browser store and image-harness fixtures.
- Full `npm test` rerun with `PV_TEST_BATCH_SIZE=6`: **1,444/1,444 PASS on 231 test files**, 0 fail/skip/todo; all 39 batches complete. The previous 18-file-per-batch attempt timed out and is not counted.
- `git diff --check`: PASS. Hosted GitHub CI was not executed for this local patch.

## Remaining work

- #24: split the WS action-dispatch and match service composition only with matching integration/fault-injection tests, then measure complexity and preserve the public contracts.
- #31: run full keyboard, focus, storage-blocked, 200% zoom and assistive-tech QA on a capable desktop browser.
- #22: rerun `npm run benchmark:image-browser -- --chrome /path/to/chromium --output ...` on a desktop/browser environment without loopback policy restrictions, review real routes at 360/1366 px and DPR1/2, and complete the artwork rights review before considering this DONE.
- No hosted CI, Supabase staging, multi-process or actual user account checks were performed in B33.
