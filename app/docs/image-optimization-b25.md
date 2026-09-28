# B25 — image delivery and manifest (optimization #22)

## Method and measured inventory

Measured the CSS slots before resizing: resource icons approximately 13–32px, navigation 17–56px; tickets/chests have a larger Bag detail slot, badges range from 24px in battle to 104px in Arena, and the selected portrait lists use 44–52px. Generated **lossless RGBA** at 56/112px (UI), 144/288px (tickets/chests), 104/208px (badges), and 72/144px (list artwork). Large hero/detail artwork retains its original 475–534px master; animated front/back sprite GIFs are deliberately untouched to preserve frames, palette, direction and forms. Do not apply LANCZOS or a universal lossy encoder to battle sprites.

| Group | Assets | Old originals | New 1× bytes | New 2× bytes |
|---|---:|---:|---:|---:|
| Navigation/reward icons | 17 | 3,239,615 | 40,572 | 91,943 |
| Tickets/chests | 9 | 7,128,877 | 207,215 | 624,151 |
| Ranked badges | 5 | 4,513,139 | 90,697 | 264,200 |
| Small Pokémon artwork | 272 | 34,891,818 | 2,120,717 | 6,024,191 |

The first three groups previously used 14,881,631 bytes when all original icons were requested; the corresponding 1× set is 338,484 bytes, 2× set 980,294 bytes. These are *all-assets inventory sums*, not a claim that a single screen loads everything. For the artwork collection, small-card transfer drops from 34,891,818 bytes to 2,120,717 bytes if every image were requested at 1×; hero views still deliberately fetch original masters. Legacy URLs have compatible downsampled 2× contents so stale direct references do not request 1254px images. Masters are kept in `app/asset-masters/ui`, not silently deleted.

## Runtime and integrity

- `public/js/image-variants.js` maps canonical URLs to immutable SHA-256-fingerprinted 1×/2× PNGs. `imageAttributes` provides `srcset`, intrinsic width/height, lazy loading and asynchronous decoding for offscreen images. Above-the-fold currency and rank marks load eagerly. The original URL stays in `src` for older code/browser fallback.
- Profile and Arena portrait cards request responsive derivatives. Hero Pokémon artwork retains the full-resolution `presentationAsset` path, and front/back animations remain GIFs.
- `docs/image-assets-b25.json` records 303 responsive source records, both variant checksums, dimensions, alpha, file bytes, rights/attribution review status, and 544 pinned pixel sprite hashes. It is verified (without Pillow or network access) by `npm run assets:responsive:validate`, included in `npm run check`; validation rejects stale maps, altered bytes, orphan variants and missing masters.
- Optional deterministic regeneration: install Pillow independently and run `python3 scripts/optimize-image-assets.py`. The checked-in variants require **no Pillow** for local installation, testing or release. The generator preserves original palette GIFs byte-for-byte.

## QA and known boundaries

- `scripts/visual-qa-images-b25.py` decodes every 303 master and compares all 606 generated PNGs **pixel-for-pixel** against lossless RGBA/LANCZOS output. PASS: **0 changed pixels**, all 303 transparency channels preserved including 23 original palette-mode artwork files. A controlled checkerboard contact sheet `docs/image-qa-b25.png` compares originals and both densities for representative badges, tickets, chests, currency and Pokémon/form artwork; visually reviewed.
- Pillow (development container, single run; *not a real browser decode benchmark*): original PNG p50/p95 **5.297/18.204 ms**, 1× **0.360/1.027 ms**, 2× **0.705/2.203 ms**. Baseline and variants are different pixel counts; the measurements indicate decode cost, not user-visible FCP/LCP.
- Node HTTP regression confirms fingerprinted images receive `immutable`, original/legacy paths remain revalidatable, PNG bodies are not recompressed and HTTP HEAD preserves the correct byte count. Intrinsic width/height and slot-level fixed CSS dimensions reserve space, with DPR2 derivatives at or above the measured CSS slots; actual real-browser CLS numbers are **not available** from this container. Headless Chromium could not start even on a trivial data page, so browser viewport/DPR visual screenshots are still recommended on the developer machine.
- Legal review is **not** automatically satisfied by a valid URL or generated manifest. UI art supplied by the project owner has undocumented redistribution rights; Pokémon sprite/artwork source documentation records the upstream but not permission to republish the character art. This batch does not claim public distribution clearance or vendor the **39 absent upstream type/category icon mirrors**; that licensing/mirror dependency stays tracked under #27. No sprites or fallbacks were deleted based only on duplicate hashes.

To rerun tests locally: `npm run check`, `node --test tests/image-assets-b25.test.mjs tests/reward-assets.test.mjs tests/ranked-assets.test.mjs` and (if Pillow is installed) `python3 scripts/visual-qa-images-b25.py`. For final release, check 360px and desktop Bag, Shop, Arena, Profile and an active battle at DPR1/2 with network throttling, verify no missing PNGs and capture Chrome CLS/FCP metrics. Do not describe that last step as already performed by this batch.

## B26 opt-in browser image harness

`npm run benchmark:image-browser -- --chrome /path/to/Chrome --output /absolute/path/outside-project/qa` launches **an isolated Chrome profile** and serves a synthetic gallery with 16 representative master/variant comparisons. At 360/1366 CSS pixels and DPR1/DPR2 it records `currentSrc`, decoded image dimensions, synthetic-page CLS, first-contentful-paint and browser Resource Timing bytes; exports eight screenshots plus `report.json`. Without Chrome on the local system the command fails and **no browser acceptance is recorded**. This isolated test does not replace screenshots or CLS/FCP review of authenticated Bag, Shop, Arena, Profile and battle routes. Do not close #22 until those real routes and usage rights have been reviewed. Run QA with output **outside** the source directory so temporary reports do not enter the release ZIP.
