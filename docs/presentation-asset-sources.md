# Presentation asset sources

The Regulation M-A presentation pack is imported from the [PokéAPI sprites repository](https://github.com/PokeAPI/sprites) through `app/scripts/fetch-presentation-assets.mjs`.

For each of the 272 selectable entries, the importer chooses:

1. front/back Gen V animated GIF when available;
2. front/back PokéAPI Showdown GIF when the Gen V animation is unavailable;
3. current PokéAPI front/back PNG when no GIF exists;
4. official-artwork PNG, with PokéAPI Home/default art only as a source fallback.

The checked-in pack contains 816 files totaling about 73.9 MiB: 258 GIF front/back pairs, 14 PNG front/back pairs and 272 PNG artwork files. All are served locally; the game makes no runtime request to PokéAPI.

`app/content-src/presentation-asset-sources-v1.json` is the machine-readable provenance ledger. It records every source URL, explicit name alias, PokéAPI numeric ID, local path, byte length and SHA-256 digest.

The PokéAPI repository license states that the repository is distributed under CC0 1.0 Universal and that all Pokémon image contents are copyright The Pokémon Company. Pokémon names, characters and imagery remain subject to their respective rights holders.
