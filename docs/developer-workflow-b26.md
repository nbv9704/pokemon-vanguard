# Supported developer workflow (B26)

This is the single operational reference for the current Node/npm **local** project. `../README.md` is the short quickstart; `../AGENTS.md` and `../app/AGENTS.md` are contributor guardrails. Historical batch notes, early audits and the archived pre-B26 README are evidence, not replacement instructions. The current statuses and unresolved dependencies are in [`project-optimization-progress-2026-09-26.md`](project-optimization-progress-2026-09-26.md).

## Prerequisites and first run

1. Install Node.js **>=22** (includes npm) and Python **>=3.11** for source-archive tooling. An internet connection is needed to install dependencies when the npm cache is empty. Extract a reviewed source ZIP or check out the current project. It intentionally contains neither `node_modules` nor any personal save.
2. Open a terminal in the **`app/` directory** and run `npm ci` (lockfile, not `npm install`), `npm run check`, and `npm test`. `npm run test:inventory` identifies the `.test.mjs` suite and explicitly archives the three legacy cloud `.test.ts` files; do not quietly count them as executed.
3. For a development **localhost-only** game, create `app/.dev.vars` with `AUTH_SESSION_SECRET=` followed by at least 32 cryptographically random, non-default characters and `AUTH_ALLOW_LOCAL_BETA=true`; leave Supabase and production `PUBLIC_ORIGIN` unset. Never paste the example secret verbatim or commit real values. Run `npm run dev` and open `http://localhost:3100`. Local beta identities and storage are *not* production authentication.
4. Stop with Ctrl+C. When editing v2 fragments, `npm run dev` recompiles `logic-src` and restarts the server. For production-oriented smoke without watchers, use `npm start` after proper account/security configuration; successful startup alone is not production acceptance.

`start-local.cmd` is a Windows convenience launcher, not a separate runtime. Node's `--env-file-if-exists=.dev.vars` loads your private development file locally. If `AUTH_SESSION_SECRET` is missing/default, authenticated standalone server startup **intentionally fails closed**; supply a real secret even for local beta development. A public service must leave `AUTH_ALLOW_LOCAL_BETA=false`.

## Source-of-truth and preserved compatibility

| Role | Edit / use | Do not mistake for active source |
| --- | --- | --- |
| V3 rules and combat | `app/rules-v3/`, `app/mechanics-v3/` | V2 generated compatibility engine |
| Server/state persistence | `app/server/`, `app/local-server.mjs` | Frozen `app/server/legacy/logic-v1.js` |
| Client, graphics and routes | `app/public/` | Archived cloud TS UI/template |
| Reviewed catalog | `app/content-active/active.json` + referenced immutable snapshots | `content-candidates/` research downloads |
| V2 legacy battles | `app/logic-src/` -> `npm run compile:logic` | Generated `app/src/logic.js`, `app/src/v2-engine.mjs` |
| Local lockfile/test entry | `app/package-lock.json`, `app/package.json` | `package.cloud.json`, `bun.lock` |

Keep `aether-*` storage keys, `.aether-window` CSS class and legacy event adapters while old saves/callers exist. See [`code-structure.md`](code-structure.md) for dependency/module conventions. Do not delete content snapshots or asset files just because hashes match: compatibility, animation frames and license checks are separate decisions.

## Account mode and data safety

The local server stores development data under `app/.local-data`. **Never use a real save as an integration fixture** or include `.local-data`, backups, `.dev.vars` or candidate downloads in a shared ZIP. Back up the entire private data directory outside the repo before testing migrations, perform a restore rehearsal **on a second copy**, and do not overwrite your only save. Use `npm run migrate:save -- --dry-run --input <path-to-copied-save.json>` only on your copy. The server already creates its own local migration backups; do not substitute that for independent external backup.

Supabase/OAuth requires actual `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, a non-default `AUTH_SESSION_SECRET` and appropriately configured provider redirects. Apply the **reviewed** `app/supabase/migrations/202609260001_atomic_pair_saves.sql` then `202609260002_admin_campaign_identity.sql`, and B29 `202609280003_admin_reporting.sql` to a disposable staging project and perform transaction/rollback/lost-ACK tests before production. The server does not automatically run migrations. Set exact HTTPS `PUBLIC_ORIGIN`, restrict trusted proxy IPs, disable local beta login and validate WebSocket/HTTP Origin/security policies at the reverse proxy. Current Supabase, multi-process and mid-match restart support remain open where the progress file says so.

## Validation and release (source archive only)

From `app/`, run `npm run check`, `npm run test:inventory`, `npm test` and `npm run workflow:validate`. The last gate checks that the **published** developer entry points and command paths agree. Content and runtime asset gates are already included in `npm run check`; regeneration of resized images *optionally* requires Pillow (`python3 scripts/optimize-image-assets.py`). `npm run assets:ui-icons:validate` is **not** an active gate while the 39 upstream mirrors/redistribution rights remain unresolved.

Build outside the project with `npm run package:full -- --output /absolute/path/PokemonVanguard.zip`, then `npm run release:verify -- /absolute/path/PokemonVanguard.zip`. On Windows pass an absolute drive-qualified path. Source ZIP entries are deterministic under one Python/zlib toolchain, each pinned by SHA-256 + CRC. Cross-OS whole-ZIP-byte identity is **not** a promised property. The verifier checks unsafe paths and the exclusion of local data; **recheck** after changing packager rules. To rehearse a clean installation: extract the verified ZIP to a new empty folder, enter `PokemonVanguard/app/`, `npm ci`, `npm run check`, `npm run workflow:validate`, `npm test`, and start a *synthetic* local beta session on a free port, never pointing the clean copy at real saves.

## Review boundaries

A clean-install check proves the commands/packaged source work in the tested environment, **not** that artwork rights have been cleared, that Chrome DPR2/CLS passed, that Linux/Windows CI passed for a new unpublished batch, or that Supabase/real OAuth is production-ready. Record exact OS, Node/Python versions, command results and remaining gaps in the progress file. Future contributors should review this page first; older `app/docs/optimization-b09-operations.md` and `docs/archive/README-pre-B26.md` are explicitly dated snapshots and must not override current status.
