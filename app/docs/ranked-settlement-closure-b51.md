# B51 — Ranked atomic settlement closure

## Outcome

Roadmap item #02 is complete: a Ranked result can become visible as settled only after both player saves and their matching settlement receipts have committed through one atomic pair-storage operation.

## Contract

1. Settlement reads both live states and, when available, both durable states.
2. A matching receipt pair is authoritative after a lost acknowledgement: the service publishes those saved states without recalculating rating or consuming another Rank Ticket.
3. Without an existing receipt pair, the service clones both states, applies rating/ticket/mission changes to the clones, and records the same settlement identity in both clones.
4. `persistPair(entries, operationId)` is mandatory for that mutation. JSON uses the pair WAL and Supabase uses the pair RPC/operation receipt.
5. Only after `persistPair` resolves does the service publish both clones and set `match.settled=true`.
6. Missing atomic storage fails with `RANKED_ATOMIC_STORAGE_REQUIRED`; no fallback may issue two independent writes.

The durable operation ID remains `ranked:settlement:<matchId>`. Reusing it with different content is rejected by the storage receipt contract.

## Failure matrix

| Failure point | Expected result |
| --- | --- |
| Atomic pair capability missing | Fail closed; no single-account write, publish, rating change or settled flag |
| Pair operation fails before commit | Both live states stay unchanged; settlement remains retryable |
| Response fails after pair commit | Retry loads the matching receipt pair and publishes once |
| Only one durable receipt exists or keys differ | `RANKED_SETTLEMENT_RECEIPT_CONFLICT`; manual recovery, no replay |
| Concurrent calls for one live match | Share `settlementPromise`; one pair commit and two account publishes |
| JSON process stops during pair write | Directory lock + WAL recovery rolls the prepared pair forward before later storage work |

## Evidence

- `ranked-settlement-contract-b51.test.mjs` checks missing capability and concurrent settlement.
- `ranked-recovery.test.mjs` checks JSON restart/lost-ACK recovery, receipt mismatch and lifecycle retry without a second pair write.
- `ranked-v1.test.mjs`, `pvp-lifecycle.test.mjs` and `ticket-bag.test.mjs` cover normal settlement, failure/retry, disconnect result and Rank Ticket consumption.
- Production wiring in `local-server.mjs` supplies `storage.savePair`; hybrid storage rejects cross-provider pairs before writing.
- Focused settlement regression: 29/29 passing. Full suite: 1,514/1,514 passing across 243 files. `npm run check` passes every source, import, lint, type, structure, content, asset, release and policy gate.

## Boundaries

- #18 remains DEFERRED for restoring an active, unfinished PvP battle, including timer and ownership state.
- #04 remains responsible for coordination/ownership across multiple server processes or hosts.
- No database migration or asset change is introduced by B51.
