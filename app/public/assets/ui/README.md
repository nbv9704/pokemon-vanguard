# Pokémon UI symbol assets

Pokémon Vanguard uses the Pokémon Legends: Arceus (LA) type-icon family and the matching LA move-category icons as presentation-only UI metadata.

Expected local layout:

- `pokemon-types/icon/` — 18 `* icon LA.png` circular icons (86×86)
- `pokemon-types/ic/` — 18 `*IC LA.png` horizontal type labels (152×36)
- `move-categories/` — `PhysicalIC LA.png`, `SpecialIC LA.png`, `StatusIC LA.png` (50×50)

Run `npm run assets:ui-icons` to vendor the source images from Bulbagarden Archives. Until then, the browser UI falls back to the matching source URLs when a local file is missing.

These are Pokémon game sprites mirrored by Bulbagarden Archives and are treated as third-party/fair-use presentation assets. Review redistribution rights before a public release.
