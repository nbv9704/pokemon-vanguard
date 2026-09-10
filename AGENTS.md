# Local development

The user wants to develop this game locally first. The active project is `app/`.
Use `npm run dev` (Node.js 22, localhost:3100), `npm run check`, and `npm test`.
Do not deploy or modify the older Higgsfield site unless the user asks.

`app/local-server.mjs` serves `app/public/` directly and persists adventure state
in `app/.local-data/`. Never commit or delete player saves as a development step.
Keep battle and economy rules in the pure `app/src/logic.js` module.

The inherited cloud files and `app/AGENTS.md` describe the original template.
Their game-logic validation contract still applies, but their cloud build,
Bun, deployment, and Durable Object commands are not the active local workflow.
`app/package.cloud.json` preserves the old package configuration for reference.
