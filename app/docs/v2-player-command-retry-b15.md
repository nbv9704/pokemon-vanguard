# B15 — Durable schema-2 Training, Team, and Blueprint commands

Status: implemented and locally verified on 27/09/2026. This batch advances
roadmap items #08 and #19 while retaining compatibility with schema-2 clients
that predate action IDs.

## Covered commands

- `build.save`;
- `team.save`;
- `blueprint.import`.

When an action ID is present, each command now uses the shared private receipt
store and a canonical payload fingerprint. The WebSocket handler reloads the
authoritative save before applying the action, persists before publishing, and
then returns `action-ack`. Retrying the exact action returns `duplicate: true`;
reusing its ID with a different payload returns `ACTION_ID_REUSED`.

Build receipts prevent a lost ACK from charging VP or updating the same build
twice. Team and Blueprint receipts prevent duplicate revisions or duplicate
imports. Old clients without `actionId` still use the former behavior and do not
receive the cross-restart guarantee.

## Client outbox

The schema-2 Training editor and Team/Blueprint editor now mint stable action IDs
and submit through the explicit commerce outbox. The exact payload survives a
reload or reconnect in `sessionStorage`, is never replayed automatically, and is
cleared only by the matching durable ACK. Blueprint payloads retain the existing
64 KiB input boundary; the outbox has a narrowly larger envelope allowance for
the surrounding action JSON.

## Verification

From `app/`:

```powershell
node --test tests/v2-player-action-retry-b15.test.mjs tests/v2-progression.test.mjs tests/training-editor.test.mjs tests/box-team.test.mjs tests/trial.test.mjs tests/v2-release.test.mjs tests/commerce-retry.test.mjs
npm run check
npm test
```

Focused coverage passed 35/35, including committed-save/lost-ACK injection for
all three command families, payload collision, exact client IDs, and a real
WebSocket restart replay. `npm run check` passed. The full suite passed
1,362/1,362 on 211 test files with zero failures, skips, or todos. Hosted CI run
[`36333909061`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36333909061)
for commit `e6053ca` passed on Ubuntu, Windows, and `release-smoke`.

## Remaining work

- Schema-2 PvE battle actions still lack the durable per-command contract.
- Ranked and Friendly PvP commands require a match-owned design; copying a
  player-save receipt into transient two-party state would not make it durable.
- Multi-device browser QA and real Supabase/multi-process fault tests remain
  necessary before roadmap items #08 and #19 can be marked complete.
