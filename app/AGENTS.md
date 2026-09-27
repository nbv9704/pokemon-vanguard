# Pokémon Vanguard — active local workflow

**Authoritative instructions: [`../AGENTS.md`](../AGENTS.md) and [`../README.md`](../README.md).**
The former tic-tac-toe/Cloudflare Workers/Bun template is **historical reference only**;
its old deployment and source-editing instructions are not the active project.

From `app/`, use Node.js >=22, `npm ci`, `npm run dev`, `npm run check`, `npm test`.
To release: `npm run package:full -- --output /outside/project.zip`, then
`npm run release:verify -- /outside/project.zip`.
Read `docs/optimization-b09-operations.md` for environment and verification limitations.

Source of truth:
- `logic-src/` fragments -> generated `src/logic.js`; **never hand-edit generated logic**.
- `mechanics-v3/`, `server/` and `content-active/active.json`: current rules, server and active data.
- `public/`: current browser client and assets.
- `server/legacy/logic-v1.js`: frozen compatibility; don't change for new gameplay.
- `content-validation/`: immutable, reviewed offline validation fixtures, hash-verified by `npm run check`.
- `content-candidates/`: unreviewed authoring-only downloads; never ship them.
- `tests/*.test.ts`: legacy cloud-runtime artifacts, explicitly inventoried but NOT executed by local `npm test`.

Keep rules deterministic and state JSON-serializable; validate untrusted actions and keep projections private.
Never commit secrets, personal saves or local debug reports. Do not modify production database or
legacy cloud deployment without explicit instruction. Respect the existing contract and progress roadmap.
