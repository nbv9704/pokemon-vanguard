# Active Node/npm local workflow

Start at [`../README.md`](../README.md) and
[`../docs/developer-workflow-b26.md`](../docs/developer-workflow-b26.md).
Commands from `app/`: `npm ci`, `npm run check`, `npm test`, `npm run dev`.
This is the authoritative local workflow, **not** the historical
Cloudflare Workers/Bun/tic-tac-toe starter.

Source-of-truth ownership:
- `rules-v3/` and `mechanics-v3/`: V3 deterministic battle rules/mechanics.
- `server/` and `local-server.mjs`: authoritative actions/storage/projections.
- `public/`: browser client, views, CSS and presentation assets.
- `content-active/active.json`: active, hash-pinned reviewed catalog pointer.
- `logic-src/` -> generated `src/logic.js` and `src/v2-engine.mjs`: V2
  compatibility. Never edit generated files directly; compile them.
- `server/legacy/logic-v1.js`: frozen V1 replay/old in-progress battles.
- `content-validation/`: reviewed fixtures; `content-candidates/`: unreviewed
  offline authoring inputs never included in source releases.
- `package.cloud.json`, `bun.lock`, old cloud TS files: archived reference,
  not local scripts. `.test.ts` cloud template tests are inventoried as archived.

Protect `.dev.vars`, `.local-data`, backup/restore files and secrets;
use separate synthetic fixtures in tests. Follow `../docs/project-optimization-progress-2026-09-26.md`
for actual status, including real-browser and cloud acceptance gaps.
