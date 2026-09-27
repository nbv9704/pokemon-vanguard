# Local JSON pair-save recovery — B03

This is the development/local JSON backend, not a replacement for the Supabase
`save_game_state_pair` SQL transaction.

## Commit / restart protocol

- Every `savePair` must contain two distinct validated local account IDs and a
  stable operation ID (`[A-Za-z0-9:_-]`, 1–160 characters).
- Calls in this **Node process** share a queue keyed by save directory, blocking
  adapter reads and writes while an operation is prepared, written or recovered.
  It is **not a lock across multiple processes**. Do not run multiple game-server
  processes against the same local save directory.
- The storage adapter persists `.transactions/pending.json` with both target
  states, original/target SHA-256 hashes and an operation fingerprint, fsyncs
  the WAL, then writes both save files via fsynced temp-file renames. After both
  reach disk, it writes an immutable small receipt into
  `.transactions/committed/`, then deletes pending WAL.
- A fresh adapter instance checks/replays unfinished WAL before exposing saved
  player state. Replay only overwrites a save if it still matches the original
  hash; if the target hash is already present it leaves the save unchanged.
  Diverged saves or corrupt WAL return an explicit error and require manual
  investigation. Never automatically discard an unreadable pending journal.
- Repeating a completed operation ID with the same full target payload returns
  `duplicate:true`. A different payload with the same ID is rejected. This
  receipt is durable but currently retained indefinitely. Review compaction
  only after a proven retry/retention policy exists.

## Fault or interrupted commit

If `savePair()` throws after the WAL write is attempted, the current adapter
enters `STORAGE_PAIR_RESTART_REQUIRED` rather than allowing stale in-memory
rooms to overwrite subsequently repaired saves. **Stop the local server**,
make a safe copy of the *entire* save directory including `.transactions`, and
restart with a new adapter. Recovery runs on the first save/load; reload both
participants from storage before allowing further actions.

For `STORAGE_PAIR_RECOVERY_CONFLICT` or `STORAGE_PAIR_JOURNAL_CORRUPT`, do not
remove the journal or continue writing. Preserve the entire directory, inspect
the original save versions and pending WAL, then perform a verified manual
reconciliation or restore from trusted backups. A crash between individual
file renames may briefly leave different versions on disk to raw external
readers; only the storage adapter gates reads. Do not claim immediate atomic
multi-file visibility. Actual power-loss behavior depends on filesystem and OS;
Windows directory fsync is not supported by this adapter.

The `package:full` script excludes `.transactions` and all player save/backup
material. This project ZIP contains the WAL implementation and synthetic tests,
**not** existing production transactions.

## Verification

`node --test tests/json-pair-journal.test.mjs tests/storage-migration.test.mjs`

Covers partial writes after the first file, failure before the first file,
commit receipt failures, same-ID retry, payload-ID conflict, concurrent
same-process callers, manually diverged targets, corrupt journal fail-closed
behavior and mixed-backend refusal. This simulates failure injection; it is not
a physical power-cut or multi-process stress test.
