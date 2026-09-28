# Project-owned UI symbol assets

Pokémon Vanguard loads only artwork supplied inside this project. There is no external icon URL, automatic download, or image proxy.

Expected local layout:

- `pokemon-types/icon/` — `bug.png` through `water.png`, one for each of the 18 type IDs (86×86)
- `pokemon-types/ic/` — the same 18 lowercase filenames, rendered as horizontal labels (120×28)
- `move-categories/` — `physical.png`, `special.png`, `status.png` (50×50)

All files must be PNGs with the exact dimensions above. Keep the lowercase filenames unchanged; the runtime contract is listed in `public/js/ui/pokemon-symbol-assets-data.js`.

During creation, `npm run assets:ui-symbols:policy` permits missing or partially supplied files while validating every file already present. `npm run assets:ui-symbols:validate` is the strict completion gate and requires all 39. Missing files render accessible text badges, so development remains usable without making a network request.

Only add art that the project owns or is independently cleared to redistribute. Do not copy the retired third-party reference sprites.
