# B52 — Account and match coordination closure

## Outcome

Roadmap item #04 is complete for the supported beta topology: one live game-coordinator process owns Ranked/Friendly rooms, while every mutation that can overlap on an account passes through the same FIFO `AccountCoordinator`.

## Lock ownership

| Operation | Reservation |
| --- | --- |
| Normal player mutation | Initiating account |
| Social request/accept/chat | Both affected accounts |
| Ranked action, settlement or lifecycle tick | Both match participants |
| Friendly create/invite/join/action | Initiator plus current room/invite target accounts |
| Friendly lifecycle/connect/disconnect | Current participant set |
| Admin ordinary/offline mutation | Target account |
| Admin stop of Ranked/Friendly match | Union of all live participants |

Account IDs are normalized, deduplicated and sorted by `AccountCoordinator`. FIFO reservations prevent a waiting pair operation from being starved by later single-account work; unrelated sets can still run concurrently. Rejection always releases the full reservation.

## Nested-lock rule

Public service methods own their reservation. `actionUnlocked`, `adminStopUnlocked`, `registerUnlocked` and `unregisterUnlocked` are composition hooks only for a caller already holding the complete participant set.

The WebSocket dispatcher uses `TrainingPvpService.actionUnlocked` inside its shared Ranked/Friendly exclusion check. Admin resolves all participants before entering `withAccountsLock`, then calls the Ranked/Friendly unlocked stop path. It never holds one account and attempts to upgrade to a two-account reservation.

## Acceptance evidence

- Barrier-controlled Social pair + Admin economy mutation preserves both the incoming friend request and the new balance.
- A Friendly command queued against an expired lifecycle deadline is serialized with the timeout; the phase resolves once.
- Admin match stop observes both participants in the active reservation and completes without nested-lock deadlock.
- Existing coordinator tests cover stable ordering, pair starvation prevention, unrelated parallelism and rejection cleanup.
- Existing Ranked recovery, Social receipt, Admin retry, WebSocket ACK and PvP lifecycle suites remain the regression boundary.
- Focused coordination/lifecycle/Admin regression: 48/48 passing.
- Full static gate: `npm run check` passing (476 syntax files, 413 modules, 1,182 local edges, zero cycles, 495 production files at or below 360 lines).
- Full regression: 1,517/1,517 tests passing across 244 files, with zero failures, skips or todos.

## Deployment boundary

The beta roadmap intentionally does not run multiple live game coordinators. Supabase CAS/pair transactions and JSON directory locks protect durable saves, but they are not a distributed in-memory match lease. Multiple live coordinator replicas would require owner leases, fencing tokens and active-match restoration; that scope remains #18 DEFERRED.

B52 adds no database migration and does not modify player saves or assets.
