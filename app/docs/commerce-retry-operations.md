# B06 — Commerce ACK/retry and WebSocket flow-control runbook

Scope: Schema-3 Shop and Roster Ranch (refresh, trial and permanent recruitment), plus browser WebSocket connection lifecycle and **in-process** socket flow control. No changes to item prices, ticket value, recruitment rates, battle rules, or Ranked rating.

## Save and ACK contract

1. The client generates a unique `actionId` for each Shop or Recruitment intent. All retries of the same intent reuse the complete original payload, including `expectedRevision` and `cycleId` when present.
2. The server reloads the authoritative save before applying a receipt-backed Shop/Recruitment action. The action implementation checks the durable receipt before stale-revision or ownership preconditions. Identical retries receive an `action-ack` with `duplicate: true`; reusing the ID with different input returns an `error` with `actionId` and `ACTION_ID_REUSED`.
3. New commands are persisted before the live room is published and before `action-ack`. The ACK contains `actionType`, `actionId`, `duplicate`, and `committedRevision`. Schema-3 recruitment now increments the account revision when recording its receipt, including explicit sync operations.
4. The client keeps exactly one unsettled paid/recruitment intent in account-scoped `sessionStorage`. State/presence pushes, a live socket, and reload do **not** clear it; only the exact ACK does. The user explicitly chooses **Retry same action** or **Discard local retry**. Discard affects only browser storage, never reverses a server commit.
5. The outbox excludes automatically generated `recruitV3.sync` operations. Those are still ordinary server commands; they do not spend currency. Legacy Schema-2 actions and other gameplay flows have not joined this common commerce outbox.

## Browser and proxy behavior

- TCP/WebSocket open is not joined/authenticated. The browser waits for the first state before allowing actions and shows `SYNCING` instead of incorrectly showing `ADVENTURE SAVED`.
- The join handshake times out after 12s and reconnect uses capped exponential backoff with bounded jitter. A terminal server close code for suspension/auth revocation stops automatic retries. A server error with an action ID is displayed on the pending commerce banner, but the browser never silently regenerates the intent.
- The server already enforces `maxPayload: 70 KiB`. B06 additionally bounds queued messages per WebSocket to 32 and closes an overactive connection (1013), and terminates a slow socket once its *already buffered* outgoing data exceeds 8 MiB. These are in-process safety rails, **not** user-level rate limits, process-wide memory limits, WAF rules or an HA ownership system. Tune only after production traffic measurements.

## QA scenarios

- Click `Use Shop Ticket`, disconnect after server write before ACK, refresh the tab, click `Retry same action`: still exactly one ticket is deducted and one item unlocked.
- Start paid Recruitment, lose ACK and let the cycle advance, then retry the original payload: existing receipt must win over stale cycle rules. No second recruitment, VP charge or mission increment.
- Simulate concurrent distinct accounts, a stale socket before join, revoked auth (close 4003), a silent joined socket, and a single socket sending more than 32 queued frames. Other sockets must not inherit the blocked client's queue limit.
- Check private save receipts/ledger are absent from public WebSocket frames. Reconfirm the same Shop `actionId` with a *different* item is rejected.

## Deployment and remaining blockers

**No live Supabase tests were performed.** Apply/verify the existing migrations `202609260001_atomic_pair_saves.sql` and `202609260002_campaign_idempotency.sql` in an authorized staging environment before using cloud transaction recovery. This batch does not implement active Ranked/Friendly match rehydration after server restart, distributed socket rate limiting, receipt archival, or a universal ACK for every game command. Do not report those items as complete.
