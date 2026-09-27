# B09 — HTTP/public caching, verified release, inventory and CI

Status: local code + clean-package tests validated. Hosted CI was triggered on 27/09/2026, but GitHub blocked both runners before their first step because the account is locked for a billing issue; end-to-end browser metrics and a successful hosted rerun remain pending.
No production deployment, save migration or asset deletion occurs in this batch.

## Active developer workflow

Use **Node.js >=22**, Python 3 and npm lockfile. From `app/`:

```
npm ci
npm run check
npm run content:inventory
npm run test:inventory
npm test
npm run dev
```

The top-level `README.md` is the quickstart. `app/AGENTS.md` points to it and replaces
old Cloudflare/Bun template instructions. Do not edit `app/src/logic.js` by hand:
edit `app/logic-src/` and compile. `app/content-validation/` is the reviewed snapshot
used by release verification; raw `content-candidates/` is *not* included.

The 3 `.test.ts` files are retired template/cloud-runtime tests, explicitly listed
by `npm run test:inventory` under `archived`; CI runs recursively discovered `.test.mjs`.
If cloud runtime is revived, create a separate explicit test job rather than silently counting them.

## Public HTTP policy

`/api/v2/catalog` and `/api/v3/catalog`: serialize once at server creation, content-hash
ETag, `Cache-Control: public, no-cache`, 304/HEAD and precomputed gzip/Brotli;
`Vary: Accept-Encoding`. Static files: bounded LRU of at most 48 text entries / 8 MiB,
conditional ETag for every file, streamed large files and binary PNGs (no re-compression).
Only names explicitly including 10+ hex fingerprint characters receive immutable cache.
Unversioned CSS/JS/HTML always revalidate. All authenticated/session/save/admin endpoints
keep their existing private/no-store policy; **never cache them using this helper**.

Run `node scripts/benchmark-http-public.mjs` for CPU/payload-size baseline. These
numbers are not browser-network or load-test results; do not claim an FPS improvement.

## Release

From `app/`: `npm run package:full -- --output /outside/PokemonVanguard.zip`.
The ZIP contains `RELEASE-MANIFEST.json` (SHA-256 and bytes per included file, no secrets),
normalized timestamp/permissions/order, and skips secret/saves/backup/candidate trees.
`npm run release:verify -- /outside/PokemonVanguard.zip` checks integrity,
member set, and policy. `--dry-run` previews included/excluded paths without content.
Zlib version may change whole ZIP bytes across machines, so per-file hashes are the
portable cross-platform verification contract. The repo source ZIP is **not** a binary
runtime deployment artifact and deliberately omits npm dependencies; run `npm ci`
after unpacking. Python helper requires Python 3.11+ for `Path.is_relative_to`.

`.github/workflows/verify-release.yml` defines Linux/Windows npm-ci/check/tests and
an Ubuntu fresh-unpack source-release smoke job. This workflow has not yet been run
on a hosted runner in the current environment. Use `PV_TEST_FORCE_EXIT=0` for a
separate handle-leak check: the main batched suite still force-exits on purpose.

B09-fix1 was verified locally on Windows after a clean `npm ci`: `npm run check`
and all 1,333 tests in 205 runnable files passed. Symlink security fixtures use a
Windows junction and the packager rejects both symlinks and reparse points. This
local result does not replace the still-pending hosted Linux/Windows workflow.

## Content inventory

`npm run content:inventory` validates the active pointer SHA-256 and reports snapshot
versions/sizes and explicit references in runtime/tests/scripts. `unclassified-retain`
means **unknown dependencies — keep in source**, not "safe to delete." Archiving
needs migration/replay data audits, hosting, checksums and restore tests first.

## Deferred dependency

PvP mid-match restart recovery (#18) and production Supabase/multi-process smoke remain
open. B09 deliberately works on independent P2/CI tracks to avoid blocking progress.

**Asset inventory caveat:** `npm run assets:ui-icons:validate` currently fails with 0/39
source-mirror icons: B08/B09 ZIPs omit those remote-fetched convenience assets.
This validation is not silently marked PASS and has not been added to the release gate;
fetch/review/license/size checks are a separate later task.
