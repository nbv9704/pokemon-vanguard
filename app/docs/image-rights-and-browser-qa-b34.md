# B34 — image #22: offline diagnostics, source review, real-route QA kit

> **Historical B34 record.** B36 removed the third-party symbol registry, downloader and runtime proxy. The active 39-file project-owned contract is documented in [`project-ui-symbols-b36.md`](project-ui-symbols-b36.md) and [`../public/assets/ui/README.md`](../public/assets/ui/README.md). The external URLs below are preserved only as audit history and are not active runtime instructions.

Status: **#22 IN PROGRESS**. The code/integrity work below is completed locally; neither browser acceptance nor public redistribution rights are claimed. This batch builds on B32 and includes B33 (the B33 corrected patch must be applied after the B32 baseline before this patch).

## Shipped safeguards

- **39 optional LA symbols:** `docs/ui-icon-rights-b34.json` records the exact allowlisted source URL, corresponding Archives file-page URL, output path and an explicit pending status *for each asset* (18 type circles, 18 type strips, 3 move categories). This is a provenance register, **not a declaration of permission**. Sample source pages for the Bug icon and Physical category contain game-sprite fair-use descriptions; do not infer the license or permission for the other 37 from those two pages.
- `npm run assets:ui-icons:policy` now checks the register, the existing all-or-none rule, file integrity and a pinned SHA-256 + documented human approval **if any local image is mirrored**. Both a partial mirror and an unreviewed local mirror fail. `npm run assets:ui-icons` refuses all downloads until all 39 records carry complete reviewed rights evidence and expected SHA-256; it verifies downloaded bytes *before writing*, bounds download size and applies a 15-second per-resource request timeout. No copyrighted icon files were added to this patch.
- When both the optional local symbol and its existing proxy fail, shared type/category image helpers replace the broken image with a compact visible, accessible text badge. Existing source order and sprite artwork are retained. The proxy remains an online dependency, **not** an offline mirror or a rights workaround.
- Synthetic gallery verifies each individual expected 1×/2× manifest URL, not just a `.png` extension. Report schema v2 compares browser transfer, decoded bytes, CLS and FCP per paired viewport/DPR run; sample selection remains stable at 16. This is a **synthetic** gallery and must not be reported as game-route QA.
- New `scripts/image-route-audit-b34.mjs` attaches to a **user-started local Chrome CDP session** to check *visible images* in a manually opened Bag, Shop, Training, Arena, Profile, Battle or modal. It verifies mapped responsive variants, DPR adequacy and missing image decode, and counts symbol-proxy dependencies. The JSON output excludes browser URLs, image alt text, user state, cookies and identifiers. Screenshots are opt-in and explicitly require confirmation of a disposable test account. No report is written inside the repository.

## Verified rights evidence vs. owner decisions

Official upstream policy and examples, checked 29 September 2026:

- Archives policy: https://archives.bulbagarden.net/wiki/Archives:Image_use_policy — third-party direct linking is not permitted by their stated policy.
- Archives copyrights: https://archives.bulbagarden.net/wiki/Archives:Copyrights — much of the collection is copyright-protected, and fair-use tagging on Archives does not itself grant this project's redistribution rights.
- Example file pages, **examples only**: https://archives.bulbagarden.net/wiki/File:Bug_icon_LA.png and https://archives.bulbagarden.net/wiki/File:PhysicalIC_LA.png.

Offline inventory from `npm run assets:rights:audit`:

| Scope | Records | Status in this source tree |
|---|---:|---|
| Optional LA type/category icons | 39 | 0 local; 39 individual pending review |
| Project-supplied UI masters | 31 | Review required |
| Responsive Pokémon portrait masters | 272 | Third-party review required |
| Pinned original pixel sprites | 544 | Upstream rights review required |
| **Total individual source records not yet approved** | **886** | **Not public-release cleared** |

The last total is **records**, not necessarily 886 independently owned creative works. No replacement assets, grants or inferred blanket licenses have been created.

When legitimate authorization is obtained, review and update the individual icon record with `status: approved`, `basis: permission | compatible-license`, a descriptive `reviewer`, ISO `reviewedAt`, HTTPS `evidence` (permission or specific license proof), and exact **SHA-256** of the reviewed file. Approval fields must stay `null` if unresolved. Obtain the expected digest without committing unreviewed files to the source tree. For existing B25 originals/sprites, a reviewer may set `licenseStatus: approved-for-public-redistribution` and an analogous `rightsEvidence` object with `status: approved`, `basis`, `reviewer`, `reviewedAt`, `evidence`, and `sha256` equal to the manifest `source.sha256` **only after checking each work**. The gate validates attestation and pinned bytes; it cannot make a legal determination. Run `npm run assets:rights:release` to see whether **all** records and local icon mirrors are ready; this command is **expected to fail today**.

If authorization cannot be obtained, commission independently designed/type-labelled replacements and update the manifest, layout and tests in a new, separately reviewed change. Do not automatically copy the original artwork or assume a server-side proxy grants reuse rights. Public release requires owner/legal sign-off, beyond automated checks.

## Real-browser checklist for the project owner

The current execution environment cannot complete Chromium QA: B34 Chrome CDP starts but navigation to the isolated gallery returns `net::ERR_BLOCKED_BY_ADMINISTRATOR` (B33 saw the same restriction). A separate trivial headless probe also timed out. Do not claim browser screenshots, screen-reader QA, first-route FCP, or accurate live CLS from this batch.

**A. Synthetic image baseline** (on a desktop with Chrome and Node/npm installed):

```sh
cd app
npm run benchmark:image-browser -- --chrome "/path/to/chrome" --output "/absolute/path/outside/the/project/pv-synthetic-qa"
```

Expect `report.json` schema v2 with 8 successful captures (baseline/optimized × 360/1366 px × DPR1/2), exact expected 1×/2× manifest URLs, 4 comparative measurements and no failed images. Compare screenshot pixel edges and alpha; compare transferBytes under the same cache and network conditions. These are measurements, not preassigned speed targets.

**B. Authenticated, real-route audit** (disposable Local Beta account and save ONLY):

1. Start the local game with the documented development configuration, then start a separate Chrome instance using a **disposable profile**, e.g. `chrome --remote-debugging-port=9222 --user-data-dir=/tmp/pv-disposable-chrome http://127.0.0.1:YOUR_APP_PORT/`. Never expose port 9222 to a network. Confirm the browser has **one matching game tab**.
2. Set Chrome device emulation to your target viewport and DPR. Open the disposable test account. On any loaded game tab run `npm run benchmark:image-routes -- --cdp 9222 --tab http://127.0.0.1:YOUR_APP_PORT/ --arm` **before navigating to the target SPA route**, to observe CLS since arming. Arming is lost on a full-document reload and must be repeated if the tab reloads.
3. Navigate the UI manually to e.g. Bag. After images have loaded, run `npm run benchmark:image-routes -- --cdp 9222 --tab http://127.0.0.1:YOUR_APP_PORT/ --label bag --output /absolute/outside/project/pv-route-qa`. Replace label for `shop`, `training`, `arena`, `profile`, `battle` or `modal`. A failed image/DPR check still writes its JSON diagnostic before returning an error. To save a PNG **only using test data**, add `--synthetic-screenshot --confirm-disposable-account`.
4. Minimum matrix: Bag, Shop, Arena, Profile, Battle at **360 and 1366 px × DPR1 and DPR2** (20 combinations). Add 768/1920 and Training/modal where available. Inspect visible pixel edges, forms, alpha and overflow. Check high-contrast, reduced-motion, 200% zoom, keyboard traversal/return focus; verify the disabled-network symbol text fallback. Check console and Network for 404/502/504 and unexpected upstream requests. Test at least one cold and one warm navigation with identical test data.
5. Judge `passed` as **image integrity only**. `clsSinceArm` is a measured *partial* CLS since arming (not a Web Vitals page-CLS guarantee); `initialDocumentFcpMs` belongs to the original document load, not the current SPA route. The script does not claim screen-reader compatibility, network throttling fidelity or overall accessibility conformity. Keep private save, screenshots and CDP port out of commits and the release ZIP.

**Remaining human gates:** execute A/B; review before/after real-route screenshots at the matrix above; manually inspect keyboard and screen-reader results; decide whether to replace/license the 39 icons and audit the 847 already-pinned image records. Once each gate has recorded passing evidence, #22 can be considered for `DONE`. These actions cannot be truthfully marked complete by offline Node tests.

## B34 automated verification record

- `npm run check`: PASS (source syntax, imports, ESLint, TypeScript, 303 responsive images, 544 sprite hashes, 35 CSS layers and icon rights/source policy).
- Complete test inventory: **233 test files, 1,456 / 1,456 PASS**, 39 independently verified TAP batches; zero failed/skipped/todo. The initial all-in-one wrapper exceeded the execution environment timeout, and is not counted as a completed wrapper run.
- `git diff --check`: PASS. No GitHub-hosted CI or remote push was attempted.
- Browser gallery: NOT ACCEPTED (`net::ERR_BLOCKED_BY_ADMINISTRATOR`); real-route matrix and assistive-technology QA remain for the desktop owner.
- Public-release rights: correctly blocked (`npm run assets:rights:release` expected failure; 886 individual pending records).
