# Pokémon Vanguard — local development

Pokémon Vanguard is a local-first Node.js game with an authoritative HTTP/WebSocket server, a browser client and reviewed V3 Pokémon Champions content. **The supported workflow is Node.js 22+ and npm, not the archived Cloudflare/Bun template.** This README is the entry point for a new checkout; operational details and security limitations live in [the developer workflow](docs/developer-workflow-b26.md).

## Quickstart (local development only)

Install **Node.js >=22** and **Python >=3.11**, then, in a terminal:

```sh
cd app
npm ci
npm run check
npm test
```

To play locally, create `app/.dev.vars` on your own machine (never add it to source control) with **only these development settings**:

```text
AUTH_SESSION_SECRET=<unique-random-string-at-least-32-characters>
AUTH_ALLOW_LOCAL_BETA=true
```

Replace the placeholder with a freshly generated random secret; the literal placeholder is rejected. Do not copy the sample Supabase keys or `PUBLIC_ORIGIN=https://play.example.com` from `.dev.vars.example` into a local configuration. Run `npm run dev` from `app/` and visit `http://localhost:3100`. The local beta login is strictly for trusted development; do not expose it to the Internet or use it with real accounts. To stop, press Ctrl+C. `npm start` runs without the dev file watchers.

`app/.dev.vars.example` documents **optional** account, reverse-proxy and quota environment settings. Real Supabase/OAuth deployment additionally needs a correctly configured account backend, an HTTPS canonical `PUBLIC_ORIGIN`, verified migrations and a separate integration/security acceptance process; having local tests pass does not certify that deployment. See [operations](docs/developer-workflow-b26.md#account-mode-and-data-safety).

## Where to change code

| Responsibility | Source of truth | Notes |
| --- | --- | --- |
| V3 battle rules | `app/rules-v3/` and `app/mechanics-v3/` | Deterministic mechanics; test before changing rule outcomes. |
| Authoritative runtime | `app/server/`, `app/local-server.mjs` | Actions, storage, Ranked and WebSocket lifecycle. |
| Browser interface | `app/public/` | Views, route CSS, responsive assets; no authoritative battle calculation. |
| Active content | `app/content-active/active.json` and reviewed catalogs | Pin snapshot hashes and preserve supported historical versions. |
| V2 compatibility logic | `app/logic-src/` | Run `npm run compile:logic`; **never edit generated** `app/src/logic.js` or `app/src/v2-engine.mjs`. |
| Old V1 engine | `app/server/legacy/logic-v1.js` | Frozen migration/active-old-battle compatibility. |
| Legacy cloud template | `app/package.cloud.json`, `app/bun.lock`, cloud TS files | Historical reference, **not** a supported local build/deploy path. |

Read [`docs/code-structure.md`](docs/code-structure.md) for module boundaries and [`app/AGENTS.md`](app/AGENTS.md) for contributor constraints. **Do not rename** `aether-*` local storage keys or `.aether-window` CSS compatibility classes just to change branding; doing so can disconnect existing saves or alter battle UI.

## Tests and release

From `app/`:

```sh
npm run check                    # source, content, asset, lint and type gates
npm run test:inventory           # runnable Node tests vs archived cloud tests
npm test                         # complete Node test suite
npm run assets:responsive:validate
npm run content:inventory          # pins historical hashes and active-only runtime scope
npm run package:full -- --output /absolute/path/outside-project/PokemonVanguard.zip
npm run release:verify -- /absolute/path/outside-project/PokemonVanguard.zip
npm run package:full -- --profile runtime --output /absolute/path/outside-project/PokemonVanguard_runtime.zip
npm run release:verify -- /absolute/path/outside-project/PokemonVanguard_runtime.zip
```

Use an **absolute output path outside the project** for the ZIP (for example `D:\Releases\PokemonVanguard.zip` on Windows). The full source ZIP preserves all 35 reviewed catalog snapshots. The optional smaller runtime-source ZIP includes only the active catalog; retained historical snapshots and immutable hashes remain in the full source ZIP. Both have a SHA-256 manifest and exclude `.local-data`, secrets and raw candidate/backup data; it does not include `node_modules`. After unpacking, run `npm ci`, `npm run check`, then `npm test` in its `app/`. Never test migrations against your only copy of a save. Python image regeneration is optional and separately requires Pillow; prebuilt image variants are already included. Details and historical restoration instructions: [`docs/catalog-retention-b27.md`](docs/catalog-retention-b27.md). Note: the 39 third-party UI symbols are NOT locally mirrored in the distributed source; their existing network fallback still needs connectivity and rights review before public distribution.

## Current scope and tracked limitations

The [optimization progress](docs/project-optimization-progress-2026-09-26.md) is authoritative for completed and unfinished work, including limitations of the latest batch. The [audit and roadmap](docs/project-optimization-audit-2026-09-26.md) describes **planned** work, not promises that every item is shipped. In particular, mid-match PvP survival across server restarts and production Supabase/multi-process verification are not complete. The UI image variants have a checksum/pixel-integrity gate but still require real-browser DPR1/2 and layout-shift acceptance for optimization #22; artwork redistribution rights also need independent review before a public release.

For the older detailed V2-era explanations, see [the archived pre-B26 README](docs/archive/README-pre-B26.md); those instructions are preserved as historical context **only** and may refer to obsolete defaults or counts. For current source ownership and commands, use this README and the developer workflow above.

Operations diagnostics (B30): `/health/live` is independent from `/health/ready`; the latter makes a throttled read-only provider check. Admin-only sanitized `/api/admin/observability` and repeatable synthetic benchmarks are described in [`app/docs/operational-observability-b30.md`](app/docs/operational-observability-b30.md). Enable `PV_OPS_JSON_LOG=true` only with controlled, rotating external log retention.

Admin cloud deployment (B29): apply reviewed migration `app/supabase/migrations/202609280003_admin_reporting.sql` **before** running the updated server against a Supabase project. See [`app/docs/admin-reporting-b29.md`](app/docs/admin-reporting-b29.md) for permissions, staging validation and safe rollback.
