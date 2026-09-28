# Pokémon Vanguard — active contributor instructions

The supported project is `app/`; follow `README.md` and `docs/developer-workflow-b26.md`.
Use **Node.js >=22 and npm**: `cd app`, `npm ci`, `npm run check`, `npm test`,
then `npm run dev` for interactive local development. The Cloudflare/Bun template
is archived, not the current deployment or editing workflow.

V3 authoritative rules belong in `app/rules-v3/` and `app/mechanics-v3/`;
server-side validation, actions and storage belong in `app/server/`;
browser views/controllers belong in `app/public/`. V2 compatibility logic is
built from ordered `app/logic-src/` fragments: run `npm run compile:logic` and
**never hand-edit** `app/src/logic.js` or `app/src/v2-engine.mjs`.
`app/server/legacy/logic-v1.js` is frozen for old battles and parity tests.
Keep compatibility names and storage keys until a separately tested migration.

Never read, copy, delete, package or overwrite a person's secrets or saves as
a development step. `app/.dev.vars` and `app/.local-data` remain private.
Keep rule resolution deterministic, state JSON-serializable, and player-facing
projections allowlisted. Source ZIPs must pass their manifest verifier;
this does not substitute for live Supabase or browser acceptance. Follow the
optimization roadmap/progress without claiming unverified items are DONE.
