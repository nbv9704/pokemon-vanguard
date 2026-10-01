# Asset redistribution decision — B47

Status: the project uses local assets only. Public release gate #36 remains unresolved because the current upstream evidence does not grant this project blanket redistribution rights for the Pokémon images. Technical image optimization/browser acceptance is closed separately under #22/B53.

## Verified inventory

| Group | Records | Current evidence | Safe release decision |
| --- | ---: | --- | --- |
| Project-supplied UI masters | 31 | Source attribution is not documented | Owner must explicitly attest creation/ownership or replace them |
| PokéAPI official artwork | 272 | PokéAPI license says the image contents are copyright The Pokémon Company | Do not auto-approve; obtain permission or replace |
| Pokémon Showdown animated sprites | 544 | Smogon sprite repository says sprites belong to Nintendo/Game Freak/The Pokémon Company; some community sprite licensing is still undetermined | Do not auto-approve; obtain permission or replace |
| Project UI symbols | 39 | Supplied under the B36 local project-owned contract | Complete; no longer part of the pending 847 records |

Primary evidence checked 30 September 2026:

- https://raw.githubusercontent.com/PokeAPI/sprites/master/LICENCE.txt
- https://github.com/smogon/sprites#license
- `content-src/presentation-asset-sources-v1.json`
- `docs/image-assets-b25.json`

Public availability, a fetchable URL, a repository's code license, and a free/non-commercial project do not independently grant redistribution rights to bundled image content. The release gate must not be bypassed by changing pending statuses without evidence tied to the reviewed file hashes.

## Owner decision required

Choose one release direction before public upload:

1. **Replace restricted Pokémon media:** provide independently created/commissioned front sprites, back sprites, and artwork, then regenerate the manifests and re-run the rights gate.
2. **Obtain permission:** record specific permission or compatible-license evidence for every reviewed work and pin it to the existing SHA-256 values.
3. **Keep the current media only for private development:** do not publish the media or present #22 as public-release ready. Local delivery #35 can remain technically complete.

The 31 project-supplied masters can be reviewed separately if the project owner explicitly confirms that they created or own all redistribution rights. That statement must not be inferred from file presence alone.

## Completed technical cleanup

`public/assets/ui/README.md` is documentation, not runtime media. B47 excludes unsupported file extensions from `asset-manifest.json`; the local inventory contains 1,495 media files and no longer classifies this documentation file as `application/octet-stream`.
