# B38 — PvP action acknowledgement contract

## Outcome

Ranked and Friendly battle decisions now remain visibly unconfirmed until the
server acknowledges the exact `actionId` **and** `actionType`. An unrelated
state/presence broadcast cannot clear the pending intent. Reconnect never
replays it automatically: the trainer must choose Retry or Discard.

## Wire semantics

`action-ack` has two explicit scopes:

- `commitStatus: "committed"` plus `committedRevision` means the Ranked
  surrender/dismiss account mutation completed durable persistence.
- `commitStatus: "session"` plus optional `authoritativeRevision` means the
  active match service accepted the command for its current authoritative
  phase. It does **not** claim restart durability; that remains deferred under
  roadmap item #18.

Malformed status/revision fields are rejected by the browser envelope parser.
Server errors retain `actionId`, so only the corresponding outbox entry is
marked failed.

## Client behavior

`PvpPendingActions` stores one bounded, validated intent per account and tab in
`sessionStorage`. It covers preview lock, commands, replacements, surrender and
result dismissal for Ranked and Friendly battles. The outbox:

1. stores the complete payload before sending;
2. survives reload in the same tab;
3. is unaffected by state/presence frames;
4. retries only after an explicit click, with the identical payload and ID;
5. clears only on matching ID + action type;
6. warns honestly that live PvP is session-scoped.

## Server behavior

Both PvP services return the current authoritative phase revision where one
exists. Friendly PvP keeps a bounded 1,000-entry session receipt map, including
canonical payload fingerprints, so two clients using the same operation ID
receive one mutation plus a duplicate ACK; reusing the ID for another payload
fails closed. Ranked retains its existing per-match fingerprint receipts and
durable two-account settlement receipts.

## Recovery/operator guidance

- If a state update arrives but the banner remains, wait for the ACK.
- After reconnect, inspect the current phase, then use **Retry same command**.
- Never create a new ID for the same uncertain intent.
- A stale phase is rejected and remains visible as a failed intent; discard it
  only after confirming the authoritative match state.
- A server restart may end an active match because #18 is deliberately
  deferred. B38 does not represent session-only commands as durable saves.

## Verification

- `npm run check`: PASS.
- Focused PvP/ACK/contract suite: 36/36 PASS before final contract tightening.
- Full `npm test`: 1,474/1,474 PASS across 235 files; 0 failed/skipped/todo.
- Regression includes state-before-ACK retention, reload, wrong-domain ACK,
  explicit same-ID retry, two-client duplicate, payload conflict, and durable
  versus session ACK parsing.
