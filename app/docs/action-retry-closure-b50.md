# B50 — End-to-end action retry closure

Roadmap item #08 is complete for the supported schema-2/schema-3 runtime. This
document defines the boundary separately from live PvP restoration (#18).

## Retry contract

Every durable player intent uses the same safety chain:

1. The browser stores the complete action and stable `actionId` before send.
2. A retry sends that exact action; it never invents a replacement ID.
3. The server loads the authoritative save and any archived receipt for the ID.
4. The canonical meaningful payload is fingerprinted. Same ID plus a different
   payload fails closed; the same payload returns the recorded result.
5. State change and receipt commit together before state publication and ACK.
6. The ACK explicitly says `commitStatus: committed`; session-owned PvP ACKs
   explicitly say `commitStatus: session`.

`player-action-retry-policy.mjs` is the machine-checked source of truth for ACK
scope. The dispatcher no longer handcrafts ACK envelopes.

## B50 gap closed

Schema-2 Recruitment (`recruit.refresh`, `recruit.trial`,
`recruit.permanent`) and Mail reward claims already wrote server receipts, but
their browser calls bypassed the durable outbox and the dispatcher did not send
an ACK. B50 routes both through `CommercePendingActions`, persists the original
payload in `sessionStorage`, loads the durable/archive receipt before retry and
returns a committed ACK after persistence.

This includes restart duplicate checks, payload-conflict checks and prevention
of a second wallet/ledger mutation. V2 mission progression is recorded only on
the first successful Recruitment mutation, never on a duplicate retry.

## Scope boundary

- Durable account, economy, reward, Social pair, PvE and Ranked settlement/
  dismissal mutations are receipt-backed and archived by B49.
- Ranked queue/preview/turn commands and all Friendly PvP commands are
  `session` scope. They dedupe in their live owner and their UI says so.
- Restoring an active match, timer and owner after process loss is #18 and stays
  DEFERRED. It is not required to call an account mutation durable.
- `mailboxV1.read` is an idempotent metadata assignment, not an entitlement or
  balance mutation. `legacy.finish` is a one-way compatibility migration.
- Multi-process coordination is #04; asset rights/browser image acceptance is
  #22. Neither is folded into the action retry contract.

## Acceptance

Focused tests cover browser reload, exact payload retention, real WebSocket
committed ACK, process restart, duplicate replay, changed-payload conflict,
wallet/ledger stability, Social pair lost ACK, V2/V3 PvE and session PvP ACK
classification. Full regression, source gates and hosted CI are recorded in the
optimization progress tracker.
