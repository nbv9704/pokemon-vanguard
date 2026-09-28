# B27 — Catalog retention, lean runtime-source archive, and verified recovery

**Scope:** optimization #27, 2026-09-28. No historical catalog was deleted from the
source archive or rewritten. Do not change Git history or an active player save to
make the archive smaller. This work does not change battle rules or the runtime
catalog version selected for existing accounts.

## Deciding what may leave a runtime-source ZIP

`app/content-active/active.json` is the **only** production lookup used by
`server/v3-catalog.mjs`; it pins a catalog version/path and SHA-256. We scanned
runtime source (`local-server.mjs`, `server/`, `public/js/`) for hard-coded
historical version strings. V3 save upgrades (`server/v3-release.mjs`) rebase old
progression against the current active catalog while retaining the former V2
roster archive when applicable; unfinished V2 battles are deferred rather than
silently replaced. The historical JSON files are **not** loaded dynamically
by the current live catalog loader.

`app/content-active/retention-manifest.json` lists every reviewed catalog
with an immutable checksum, byte count, and an explicit classification:

- `active-runtime`: exactly one catalog referenced by the current active pointer.
- `source-history`: historical provenance, maintained in full-source archive for
  reconstructing content, comparing snapshots and future compatibility work;
  not removed from source control, and never advertised as recoverable externally.

Historical snapshots are retained even if not referenced in today's runtime.
The minimized ZIP is a **runtime-source** variant: it still contains source code,
tests, required assets and tooling, but omits exactly the 34 pinned historical
JSON snapshots. It is not a minified compiled/binary deployment. It uses the
same trusted dependency lockfile as the full source ZIP and deliberately omits
installed `node_modules`, secrets, saves, local backups and raw candidates.

## Commands (Node 22+, Python 3.11+, from `app/`)

```sh
npm run catalog:retention:validate
npm run assets:ui-icons:policy
npm run check
npm run package:full -- --output /absolute/outside/path/vanguard-source.zip
npm run package:full -- --profile runtime --output /absolute/outside/path/vanguard-runtime.zip
npm run release:verify -- /absolute/outside/path/vanguard-source.zip
npm run release:verify -- /absolute/outside/path/vanguard-runtime.zip
```

The packager hashes **every historical source JSON before omission**, even
when building the small runtime variant. The ZIP verifier independently
checks included hashes, classifications, safe membership, CRC and that a
runtime ZIP contains exactly the active snapshot. The clean-unpacked runtime
archive autodetects its profile and `npm run check` applies the corresponding
validation; source checks require every historical catalog to remain present.
The CI release job exercises both ZIP types with clean extraction, npm install,
validation and saved-game upgrade tests. Its outcome is only confirmed after
that workflow actually runs; local success alone is not hosted CI evidence.

## Future catalog promotions and restoring historical provenance

1. Promote a reviewed catalog using the existing content-promotion workflow.
   Record its new version and SHA-256 in `retention-manifest.json`, explicitly
   reclassify the former active to `source-history`, and preserve its **existing**
   bytes, checksum and history. Never auto-regenerate the manifest in a way
   that accepts silent changes to an existing snapshot.
2. Run the inventory, `npm run check`, V2/V3 migration tests and both release
   profiles. Unknown versions, stale active pointers and mutated history fail.
   The release verifier rejects unexpectedly included or missing historical
   JSONs. If a real historical replay actually requires an old catalog in the
   future, change the supported-runtime set only after adding replay tests.
3. For analysis of a historical version omitted from the lean runtime ZIP,
   use the **full source ZIP of the matching release**. Verify it using
   `npm run release:verify`, then use that snapshot in an isolated analysis
   directory. Never replace the running server's current active pointer or
   apply the old catalog to player saves in place.

### Acceptance evidence / explicit limitations

The B27 fixture tests cover tampering, stale active hashes, unreviewed extra
versions, wrong runtime membership and independent ZIP verification. The
clean-runtime smoke runs `npm run check` plus V3 upgrade, active team and
API-server tests. It does **not** establish mid-battle replay of all historical
versions; PvP restart recovery is separately deferred under optimization #18.

The 39 third-party Pokémon-style UI symbols in the original source release
were missing locally. The newly integrated icon **distribution-policy** gate
reports all-local or intentionally all-fallback, but fails on partial/corrupt
mirrors and never fetches online during CI. Today it explicitly reports
**0/39 local; network fallback only**. Offline play remains possible for game
logic, but those visual symbols will not appear offline. Rights review and
visual image acceptance remain part of #22 before any public artwork rollout;
this batch does not claim these assets were licensed, mirrored or optimized.
