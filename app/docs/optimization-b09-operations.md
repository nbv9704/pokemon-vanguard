> **Historical B09 snapshot.** For the supported present-day workflow, read the root `README.md` and `docs/developer-workflow-b26.md`; later optimizations and unresolved limitations are tracked in the progress file.

# B09 — HTTP/public caching, verified release, inventory and CI

Status: local code, clean-package tests and hosted Linux/Windows CI validated on 27/09/2026. End-to-end browser metrics remain pending.
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
an Ubuntu fresh-unpack source-release smoke job. Hosted run 36305711464 passed all
three jobs. Use `PV_TEST_FORCE_EXIT=0` for a separate handle-leak check: the main
batched suite still force-exits on purpose.

B09-fix1 was verified locally on Windows after a clean `npm ci`: `npm run check`
and all 1,333 tests in 205 runnable files passed. Symlink security fixtures use a
Windows junction and the packager rejects both symlinks and reparse points. This
was repeated from a clean Windows clone; hosted Linux/Windows validation and the
Ubuntu exact-unpack release smoke also passed. Archive members always use the
stable `PokemonVanguard` root, independent of the checkout directory name.

## Content inventory

`npm run content:inventory` validates the active pointer SHA-256 and reports snapshot
versions/sizes and explicit references in runtime/tests/scripts. `unclassified-retain`
means **unknown dependencies — keep in source**, not "safe to delete." Archiving
needs migration/replay data audits, hosting, checksums and restore tests first.

## Deferred dependency

PvP mid-match restart recovery (#18) and production Supabase/multi-process smoke remain
open. B09 deliberately works on independent P2/CI tracks to avoid blocking progress.

**Current asset note (B36 supersedes the historical B09 approach):** the runtime no longer
fetches or proxies third-party type/category sprites. It points to 39 project-owned local
paths documented in `public/assets/ui/README.md`; missing art becomes a text badge.
`npm run assets:ui-symbols:policy` validates files supplied so far and the strict
`npm run assets:ui-symbols:validate` command requires the complete set.
