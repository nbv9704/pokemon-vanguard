# Pokémon UI symbol assets

Pokémon Vanguard uses the Pokémon Legends: Arceus (LA) type-icon family and the matching LA move-category icons as presentation-only UI metadata.

Expected local layout:

- `pokemon-types/icon/` — 18 `* icon LA.png` circular icons (86×86)
- `pokemon-types/ic/` — 18 `*IC LA.png` horizontal type labels (152×36)
- `move-categories/` — `PhysicalIC LA.png`, `SpecialIC LA.png`, `StatusIC LA.png` (50×50)

The tree intentionally contains **no** third-party icon binaries. `npm run assets:ui-icons` is now disabled until all 39 individual rights records have documented permission or a compatible license and pinned SHA-256 checksums. See `app/docs/image-rights-and-browser-qa-b34.md` and `app/docs/ui-icon-rights-b34.json` (repository-root paths).

The current UI tries local files and then its existing allowlisted upstream proxy; if both fail, it renders accessible text badges instead of broken images. The proxy is an unresolved external dependency, not evidence of redistribution permission. Third-party fair-use labels cannot be copied into a license grant for this game.
