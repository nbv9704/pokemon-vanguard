# B49 — Bounded hot state with durable retry archive

Status: implemented and verified on 01/10/2026. Roadmap item #09 is complete in
the supported single-server storage model. Distributed ownership remains #04;
mid-match PvP persistence remains #18.

## Contract

The active save keeps only the newest records required for normal UI and retry
traffic. Older records move to a private durable archive; they are never simply
discarded. Before applying an action with an old ID, storage retrieves only the
matching archived record and temporarily hydrates its original collection, so
the existing fingerprint/conflict/result logic remains authoritative.

| Collection | Hot limit | Archived lookup key |
| --- | ---: | --- |
| `actionReceipts` | 512 | `actionId` |
| `economyLedger` | 512 | `receiptId` |
| `rewardReceipts` | 256 | `receiptId` |
| `socialActionReceiptsV1` | 512 | `actionId` |
| `adminActionReceiptsV1` | 256 | `actionId` |
| `adminGiftDeliveryReceiptsV1` | 256 | `campaignId` |
| `rankedSettlementReceiptsV1` | 128 | `matchId` |
| Finished legacy/V2/V3 battle events | 512 | audit archive only |

Active battle history is not truncated while a battle is playable. Social chat
was already bounded to 100 friends and 100 messages per conversation; Admin
audit was already bounded to 100 entries.

## Crash safety and providers

Compaction is deliberately two-phase:

1. Commit the full state containing the mutation and receipt.
2. Persist every overflow record idempotently in the archive.
3. Remove the archived prefix from the in-memory state and commit the compact
   state.

A crash before step 3 leaves a larger save, not a missing replay barrier. JSON
storage uses immutable segmented archive files plus an atomic generation
manifest under `.hot-archive`; one segment contains at most 256 records and old
replacement segments are removed only after the new manifest is durable. Pair
saves use a second WAL operation ID for the compact form.

Supabase reuses the private `game_save_backups` table with `hot-v1:` labels. It
batches archive reads/writes and never grants browser roles access. Apply
`supabase/migrations/202610010004_hot_state_archive_index.sql` before production
rollout so `(user_id, label)` lookup stays indexed. The archive remains
functionally correct without the index, but a large production archive must not
be deployed with table scans.

## Synthetic benchmark

`npm run benchmark:hot-state` uses generated state only and deletes its temp
directory. Windows / Node v22.15.0 results:

| Entries per unbounded branch | Before | Hot save | Reduction | Initial safe archive + compact | Hot serialize p95 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 1,692,987 B | 1,384,902 B | 18.198% | 143.637 ms | 6.671 ms |
| 10,000 | 7,431,183 B | 1,387,464 B | 81.329% | 807.757 ms | 5.609 ms |
| 100,000 | 65,263,089 B | 1,390,026 B | 97.870% | 7,486.343 ms | 5.403 ms |

The 100k timing is the one-time migration path that durably archives 298,464
overflow records. Steady state archives only newly overflowing records. The hot
save remains roughly 1.39 MB here because the fixture intentionally includes
the already-bounded 10,000-message Social dataset (~1.06 MB).

## Acceptance

- JSON single and pair saves compact both accounts and resolve an archived retry.
- A child Node process resolves an old receipt after an actual process restart.
- A retry older than the hot window returns its original result and performs no
  second persistence call.
- Mocked Supabase saves full state, archives in batches, commits compact state,
  then hydrates one old key; migration policy is statically verified.
- Existing lost-ACK Social, Ranked, Shop and Recruitment regressions still pass.
- `npm run check`, full regression and hosted CI are recorded in the B49 progress
  entry rather than inferred from this design document.
