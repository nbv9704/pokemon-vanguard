# B16 — Durable schema-2 PvE battle commands

Status: implemented and locally verified on 27/09/2026. This closes the planned
schema-2 PvE command gap for roadmap items #08 and #19; PvP remains a separate
two-party durability problem.

## Covered commands

- `battleV2.preview.start`;
- `battleV2.preview.lock`;
- `battleV2.commands`;
- `battleV2.replacements`;
- `battleV2.surrender`.

The server accepts old commands without IDs for compatibility. Current clients
attach an action ID and use the explicit session outbox. For identified actions,
the server loads the authoritative save, checks a private canonical fingerprint,
applies the command once, persists the battle/receipt/reward/mission changes as
one save, publishes the state, and only then sends `action-ack`.

An exact retry returns the durable battle phase as `duplicate: true`. Reusing an
ID with a different command returns `ACTION_ID_REUSED`. In particular, a command
that ends a battle cannot settle its reward or mission progress twice after the
first save succeeds but its ACK is lost.

## Client behavior

The schema-2 Battle screen creates stable IDs for preview, lock, turn command,
replacement, and surrender actions. Gym and other entry points that launch a
schema-2 preview use the same outbox. The pending intent survives reload or
reconnect in `sessionStorage`, is never replayed automatically, and clears only
after its matching ACK.

## Verification

From `app/`:

```powershell
node --test tests/v2-battle-retry-b16.test.mjs tests/v2-tactical.test.mjs tests/v2-tactical-server.test.mjs tests/local.test.mjs tests/trial.test.mjs tests/v2-release.test.mjs tests/commerce-retry.test.mjs
npm run check
npm test
```

Focused coverage passed 40/40. It includes lost-ACK injection for preview and a
reward-settling finishing command, payload collision, stable UI IDs/outbox, and a
real WebSocket restart replay. `npm run check` passed. The full suite passed
1,367/1,367 on 212 test files with zero failures, skips, or todos. Hosted CI is
green for commit `dcc86ce`: Ubuntu, Windows, and `release-smoke` all passed in
[run 36334876906](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36334876906).

## Remaining work

- Ranked and Friendly PvP need match-owned durable turn receipts plus snapshot,
  revision, timer, and process-ownership semantics; player-save receipts alone
  cannot make their transient shared battle durable.
- Receipt archival/compaction must retain a long-lived replay barrier.
- Multi-device browser QA and real Supabase/multi-process fault tests remain
  necessary before roadmap items #08 and #19 can be marked complete.
