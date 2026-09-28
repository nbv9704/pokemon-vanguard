# B32 CSS cascade contract and visual parity

Date: 2026-09-28

## Result

Roadmap item #23 is complete for the active player, Classic and Admin entries.
Every active stylesheet now belongs to an explicit native CSS cascade layer, and
all three HTML entry points load the layer-order contract before layered CSS.
Lazy route styles remain lazy and carry their layer in the stylesheet itself.

The stable order is:

1. `pv.reset`
2. `pv.tokens`
3. `pv.base`
4. `pv.components`
5. `pv.routes`
6. `pv.theme`
7. `pv.overrides`

`public/cascade-contract.css` owns only that order. `public/tokens.css` owns the
base root tokens. The manifest in `scripts/css-layer-manifest-b32.mjs` classifies
all 35 active CSS files; an unknown or missing stylesheet fails validation.
Existing source order is retained inside each layer, so this migration does not
sort selectors, concatenate files, eagerly load route CSS, rename compatibility
classes or modify battle/event contracts.

## Inventory and guard

The B32 validator records the migration baseline as 35 stylesheets, 3,155
selector blocks, 67 selectors repeated across files, six root/theme token rules
and 1,062 `!important` declarations. The last number is intentionally not
presented as clean: most come from the established Pixel Era geometry contract.
Removing them mechanically would change specificity. The automated budget now
fails if the count grows above 1,062, allowing later batches to reduce it safely.

`npm run css:cascade:validate`, included in `npm run check`, verifies:

- the fixed layer order;
- complete stylesheet classification;
- the expected outer layer envelope for every CSS file;
- no hidden `@import` inside a layer;
- one base token root in `tokens.css`;
- the `!important` ceiling; and
- `cascade-contract.css` being the first stylesheet in the player, Classic and
  Admin HTML entries.

The targeted test also keeps `.aether-window` as a compatibility interface and
contains negative cases for unlayered CSS and hidden imports.

## Browser parity evidence

A real-browser baseline was captured before migration using a disposable Local
Beta save. The same flows were repeated after migration with a fresh disposable
save:

| Surface | 360 | 768 | 1366 | 1920 |
| --- | --- | --- | --- | --- |
| Bag | PASS | PASS | PASS | PASS |
| Shop | PASS | PASS | PASS | PASS |
| Training | PASS | PASS | PASS | PASS |
| Arena | PASS | PASS | PASS | PASS |
| Battle Practice | PASS | PASS | PASS | PASS |
| Surrender confirmation modal | PASS | PASS | PASS | PASS |

At 1366 px, Reduced motion, High contrast and Larger text were each enabled
through the actual Settings UI and checked again on Shop. Navigation, focus,
modal trap/return, lazy style readiness, content, clipping and responsive
breakpoints remained intact. Training and Arena were byte-identical at all four
widths; Bag was byte-identical at three widths. Other PNGs contain expected
non-deterministic focus/selection paint and animated battle sprite frames, so
they were compared visually rather than misreported as byte-identical.

The complete before/after SHA-256 and pixel-difference measurements are stored
in `docs/css-cascade-visual-b32.json`. Screenshots themselves were temporary QA
artifacts and contained only synthetic Local Beta data.

## Hosted verification

GitHub Actions run
[`36438404463`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36438404463)
for source commit `4476b4f` passed `validate (ubuntu-latest)`,
`validate (windows-latest)` and `release-smoke`.

## Scope limits

This batch establishes and enforces cascade ownership; it does not bundle or
minify CSS, change gameplay rules, replace the existing visual theme, or claim
that all historical `!important` rules have been removed. Future cleanup can now
reduce duplicates and specificity debt one reviewed component at a time without
reopening the layer contract.
