# B04 — Social retry and Ranked settlement/result recovery

This builds on B03 local JSON WAL and the cloud `save_game_state_pair` RPC.
It addresses committed operations whose server response was lost; it does **not**
restore an in-progress battle after a process restart.

## Social

- Current Friends & Chat UI supplies an `actionId` per request, acceptance,
  rejection, cancellation, removal or message. The Social service validates
  provided IDs, hashes the meaningful action payload and writes the initiating
  account's `socialActionReceiptsV1` entry **inside the same pair save** as both
  accounts' Social state. Retrying an existing ID with a different payload
  returns `SOCIAL_ACTION_ID_CONFLICT` without modifying either account.
- A retry checks durable storage even when an old room remains in memory. If a
  stored receipt matches, the service reloads both accounts and returns
  `{ok:true,duplicate:true}` without creating a second message/request.
- For safety the production Social service must keep its `persistPair` backend,
  per-account coordinator and cloud pair-RPC migration. A test-only separate
  pair of `persist()` calls is **not** an atomic substitute.
- Legacy actions without an ID remain supported but cannot guarantee dedupe
  across lost ACKs or process restarts. UI action IDs are not persisted across
  page reloads, so browser-side retry UX still needs a unified action envelope.
- Receipts are private server fields; only the existing Friends & Chat DTO is
  sent over WebSocket. Receipts are intentionally **not** pruned until durable
  archival/dedupe retention is designed (roadmap #08/#09).

## Ranked

- Settling a match writes `rankedSettlementReceiptsV1` to **both** accounts in
  the same pair transaction as RP, protection tickets, history and missions.
  Both copies share a match/participants/mode/winner fingerprint; each contains
  its own result details. A retry after lost response loads both saved copies,
  verifies the fingerprint and publishes the already committed outcome. It does
  not calculate rating or consume another ticket again.
- When the server restarts after a successful settlement, an unacknowledged
  recent result (up to `PVP_TIMERS.resultRetentionMs`, currently 10 minutes) is
  reconstructed for that player without rebuilding a live battle. The client
  intentionally displays a recovered result on initial hydration rather than
  dismissing it as stale. Dismissal is persisted per player.
- On settlement failure with a finished live match, the lifecycle tick attempts
  recovery again. For a surrender, repeating the *same* in-memory action ID
  also retries settlement. A new surrender from either participant is blocked
  while settlement is pending. In-memory action fingerprint checks detect ID
  reuse with a different command while the match exists; full durable command
  envelopes are a separate roadmap step.
- One-sided or mismatched settlement receipts return
  `RANKED_SETTLEMENT_RECEIPT_CONFLICT` and **must not** trigger another credit,
  debit or forced overwrite. Inspect the storage transaction/journal and
  correlated logs on a safely copied test/offline instance. Do not delete a
  receipt or a pending JSON WAL to force settlement.

## Explicit remaining limits

- A mid-battle restart still loses its in-memory match state and timers; do not
  claim full PvP match recovery (#18). Administrative no-contest is not a Ranked
  RP settlement, so it has no durable Ranked result receipt yet.
- JSON WAL is single-process and requires restart if the adapter reports
  `STORAGE_PAIR_RESTART_REQUIRED`. See `local-json-recovery.md`.
- Supabase pair RPC and admin campaign migrations must be applied/tested in a
  disposable environment before any production rollout. B04 tests here use
  isolated synthetic JSON accounts, not production storage.
- Hot save size/receipt archival, full player action envelope, browser retry
  across reload, power-loss, multi-process and cloud failover tests remain open.

## Focused verification

```bash
node --test tests/social-receipts.test.mjs tests/ranked-recovery.test.mjs tests/completed-battle-results.test.mjs
```
