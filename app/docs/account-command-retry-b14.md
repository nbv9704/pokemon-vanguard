# B14 — Durable Mission, Admin Gift, and Rank protection commands

Status: implemented and locally verified on 27/09/2026. This batch advances
roadmap items #08 and #19 without claiming that every legacy or PvP command is
covered.

## Scope

The following player mutations now share the durable retry contract already used
by Shop, Recruitment, Training, Team management, and schema-3 PvE actions:

- `mission.claim` and `mission.claimAll`;
- `adminGift.claim`;
- `bagV1.rankProtection`.

For each action with an ID, the server stores a private receipt containing a
canonical payload fingerprint. Before applying a retry, the WebSocket handler
loads the authoritative save instead of trusting the live room state. The
contract is:

1. a new ID and payload are applied and persisted before publication;
2. the same ID and payload return `duplicate: true` without another mutation;
3. the same ID with a different payload fails with `ACTION_ID_REUSED`;
4. only after durable persistence does the server send `action-ack`;
5. receipts remain private and are not projected to the browser.

Old Admin Gift and Bag clients without an action ID remain accepted for
compatibility, but they cannot receive the cross-restart receipt guarantee.
Mission actions already required an ID and continue to do so.

## Client behavior

Mission claims, Admin Gift claims, and Rank protection changes now use the same
single-intent `sessionStorage` outbox as other commerce commands. The outbox keeps
the exact payload and ID through reload or reconnect, never retries
automatically, and clears only after the matching `action-ack`. A new mutation is
blocked until the user retries or explicitly discards the unresolved intent.

Mailbox read state is not included: it is non-economic metadata and its existing
operation is naturally idempotent. Legacy schema-2 management/battle actions and
PvP per-turn durability remain separate roadmap work.

## Verification

Focused coverage includes synthetic lost-ACK-after-save faults, restart replay,
payload collision, exact outbox restoration, and real WebSocket ACKs before and
after server restart.

From `app/`:

```powershell
node --test tests/durable-account-actions-b14.test.mjs tests/commerce-websocket-ack.test.mjs tests/commerce-retry.test.mjs tests/missions.test.mjs tests/ticket-bag.test.mjs tests/admin.test.mjs tests/admin-campaigns.test.mjs tests/mailbox-v1.test.mjs
npm run check
npm test
```

The focused suite passed 53/53. `npm run check` passed, and the full suite passed
1,357/1,357 on 210 test files with zero failures, skips, or todos. Hosted CI run
[`36333278519`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36333278519)
for commit `deaf171` passed on Ubuntu, Windows, and `release-smoke`.

## Remaining work

- Inventory and wrap schema-2 Training/Team/import commands where compatibility
  still permits mutation without an action ID.
- Design PvP per-turn receipts together with match revision and process ownership;
  a player-save receipt alone is not sufficient for two-party transient state.
- Run multi-device/browser QA and real Supabase/multi-process fault tests before
  marking #08 or #19 complete.
