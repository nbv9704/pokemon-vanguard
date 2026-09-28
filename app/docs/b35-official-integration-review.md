# B35 official integration review

Date: 29/09/2026. Source: `unofficial/PokemonVanguard_B35_FULL`, based on
official B32 commit `ea7322f` with the B33 corrected, B34 and B35 patches.

## Integrated scope

- B33 extracts HTTP routing and the public-state allowlist, hardens
  `localStorage` property access, and preserves the original server API.
- B34 keeps all 39 optional upstream icons fallback-only until each rights
  record has a human approval and pinned checksum. No icon was downloaded or
  added. The public-release rights gate remains intentionally closed for 886
  records pending review.
- B35 extracts WebSocket transport, player action dispatch, Ranked domains,
  mechanics-manifest validation, client shell/modal/action views and Admin
  templates behind their existing facades. The new module gate enforces 45
  ownership/delegation and byte-budget assertions.

Only the 56 B33-B35 changed paths were transferred. `.git`, `node_modules`,
local saves, secrets, reports and ZIP metadata were not copied. Before the one
review fix below, every transferred path matched the B35 source by SHA-256 and
the two progress documents were byte-identical.

## Review correction

The B34 partial-icon-mirror negative fixture compared a native Windows path
against a slash-separated manifest path. It therefore did not insert its fake
partial icon on Windows and could pass without exercising the intended
rejection. The fixture now normalizes path separators before matching. Product
code and the fail-closed rights policy are unchanged.

The corrected test passes alone (8/8) and in the cross-domain focused run
(72/72), proving the partial and unapproved mirror branches execute on Windows.

## Verification on the official checkout

- `npm run check`: PASS; 400 modules, 1,159 local edges, zero cycles; 476
  production modules, maximum 345/360 lines; 35 CSS layers; all 45 B35 module
  assertions pass.
- Focused HTTP/WS, projection, Ranked/PvP, UI split and image-rights tests:
  72/72 PASS.
- Full `PV_TEST_BATCH_SIZE=6 npm test`: 1,468/1,468 PASS over 234 runnable test
  files; zero failed, skipped or TODO tests. Three retired Cloud TypeScript
  tests remain explicitly archived.
- Real-browser smoke with a disposable save: Home, Shop, Training, immersive
  Arena, account menu and Settings render and navigate with the socket ONLINE.
  The browser tab, server and temporary save were removed afterward.
- GitHub Actions run
  [`36474757624`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36474757624)
  for commit `876bf7c` passed Ubuntu validation, Windows validation and
  `release-smoke`.
- `git diff --check`: PASS. No player save, secret, database migration, catalog
  or combat algorithm was changed by the integration review.

## Honest remaining limits

Optimization #24 is complete under its accepted module-ownership contract.
#22 remains in progress until the real-route DPR/accessibility matrix and asset
rights review are completed; #31 remains in progress until broader keyboard,
zoom and assistive-technology acceptance. The browser smoke above is not a
substitute for those matrices. Supabase staging and distributed concurrency
also remain outside this integration.
