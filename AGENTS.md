# Local development

The user wants to develop this game locally first. The active project is `app/`.
Use `npm run dev` (Node.js 22, localhost:3100), `npm run check`, and `npm test`.
Do not deploy or modify the older Higgsfield site unless the user asks.

`app/local-server.mjs` serves `app/public/` directly and persists adventure state
in `app/.local-data/`. Never commit or delete player saves as a development step.
Keep battle and economy rules in the pure `app/src/logic.js` module.

Keep source modules small and cohesive. Split a file when it starts owning more
than one clear responsibility (for example validation, resolution, event
projection, and persistence must not grow together). Prefer several ordered
`app/logic-src/` fragments with explicit names over a large catch-all file;
generated file size does not count because `app/src/logic.js` is never edited by
hand. Check line and byte counts during each milestone and refactor before adding
the next concern.

`app/src/logic.js` is now generated. Edit the explicitly ordered files in
`app/logic-src/`, then run `npm run compile:logic`; never edit the generated file
directly. `app/server/legacy/logic-v1.js` is the frozen v1 engine used only for
old in-progress battles and parity tests. Do not change it while building v2.

The inherited cloud files and `app/AGENTS.md` describe the original template.
Their game-logic validation contract still applies, but their cloud build,
Bun, deployment, and Durable Object commands are not the active local workflow.
`app/package.cloud.json` preserves the old package configuration for reference.
