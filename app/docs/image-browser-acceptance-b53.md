# B53 — image optimization browser acceptance

## Outcome

Optimization item #22 is complete as a technical image/manifest item. Public redistribution rights are intentionally tracked separately as release gate #36; completing transfer, DPR and browser acceptance does not grant rights to third-party media.

## Chrome DPR evidence

The isolated Chrome harness ran against the checked-in responsive manifest with 16 stable samples from UI icons, item art, rank art and Pokémon artwork.

| Viewport | DPR | Baseline transfer | Optimized transfer | Saved | CLS |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 360 | 1 | 7,903,341 B | 218,292 B | 7,685,049 B | 0 |
| 360 | 2 | 7,903,341 B | 633,093 B | 7,270,248 B | 0 |
| 1366 | 1 | 7,903,341 B | 218,292 B | 7,685,049 B | 0 |
| 1366 | 2 | 7,903,341 B | 633,093 B | 7,270,248 B | 0 |

All eight baseline/optimized captures completed in installed desktop Chrome. Every optimized image selected the exact manifest 1x/2x candidate for its DPR, decoded successfully and met the required physical density. The report and screenshots stayed outside the checkout in the OS temporary directory and contain no player data.

## Real-route acceptance

An isolated local server used a new temporary save directory, a synthetic Local Beta account and loopback-only binding. No `.dev.vars`, `.local-data`, real save or remote storage was read.

Home, Bag, Shop, Profile, Arena and a live Team Preview were inspected at 1366×900. Home, Bag, Shop, Profile and Team Preview were also inspected at 360×800 under the project's fixed 1280×720 logical viewport contract. The inspected routes had no missing/failed visible image, no document-level horizontal overflow and remained connected.

The browser found a real Home-only defect: transformed decorative artwork made `.content` horizontally scrollable by 45 px at desktop width. The Pixel Era Home surface now hides horizontal overflow while retaining vertical route scrolling. A source regression in `r3-resolution-lock.test.mjs` locks this behavior. Chrome confirmation shows `overflow-x: hidden`, `overflow-y: auto` and no horizontal scrollbar.

Keyboard smoke traversed the full primary navigation in order. Account-menu ArrowDown reached the next menu item and Escape closed the menu while restoring focus to the account button. Broader reduced-motion, forced-colors, landmarks, route focus and modal behavior remain covered by completed item #31 and its browser/source acceptance.

## Automated evidence

- Focused image/CSS/accessibility suite: 32/32 passing.
- Responsive inventory: 303 source images, 606 lossless 1x/2x variants and 544 pinned original sprites remain checksum/dimension verified.
- Project UI symbols: 39/39 local files pass their strict dimension/runtime policy.
- Full project `npm run check` and `npm test` passed; hosted run [`36813560857`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36813560857) passed Ubuntu, Windows and `release-smoke` for commit `65662a3`.

## Boundary: release rights

The repository still identifies 272 artwork files as PokéAPI official artwork and 544 animated sprites as Pokémon Showdown sources; 31 project-supplied UI masters also lack a recorded redistribution attestation. Their 847 pinned records remain unresolved for public redistribution. B53 does not relabel those files or infer ownership from local possession.

Release gate #36 owns replacement/permission evidence and keeps `npm run assets:rights:release` fail-closed until every source hash has acceptable evidence. The runtime remains local-only under completed item #35.
