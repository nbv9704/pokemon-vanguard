# B36 — project-owned type and move-category symbols

Status: **local-only runtime contract complete; all 39 project-owned assets supplied and validated**.

The browser now references only 39 stable project paths: 18 type icons, 18 type strips and three move-category images. The server-side upstream allowlist/proxy, network downloader, third-party rights registry and client proxy retry were removed. A missing local image is replaced immediately with an accessible text badge, so development and offline use remain functional while art is created.

## Drop-in contract

Create PNG files using lowercase type/category IDs:

- `public/assets/ui/pokemon-types/icon/<type>.png` — 86×86
- `public/assets/ui/pokemon-types/ic/<type>.png` — 120×28
- `public/assets/ui/move-categories/{physical,special,status}.png` — 50×50

The 18 type IDs are `bug`, `dark`, `dragon`, `electric`, `fairy`, `fighting`, `fire`, `flying`, `ghost`, `grass`, `ground`, `ice`, `normal`, `poison`, `psychic`, `rock`, `steel`, and `water`. Do not rename files or add a second lookup convention.

Run `npm run assets:ui-symbols:policy` during incremental work. It permits absent files but checks every present file is a PNG of the exact expected dimensions and verifies active runtime modules contain no external/proxy dependency. Run `npm run assets:ui-symbols:validate` when the set is complete; it fails unless all 39 files pass.

The old `assets:ui-icons*` commands remain compatibility aliases, but they no longer download anything. Only original project artwork or independently cleared artwork belongs in these paths. The B34 third-party source list is historical and must not be copied into the project.

## Scope and remaining release work

This change resolves the type/category icon delivery design and removes its external network and payment/availability concern. All 39 project-owned PNGs are present under the documented local paths; the horizontal type strips intentionally use their native 120×28 dimensions. This does not clear the separate 847 image records already tracked for responsive UI/Pokémon assets. Real-route DPR, visual, keyboard and assistive-technology checks in #22 remain open.
