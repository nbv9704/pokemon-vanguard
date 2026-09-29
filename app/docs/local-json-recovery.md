# Local JSON save and pair recovery — B03/B43

This is the development/local JSON backend, not a replacement for the Supabase
`save_game_state_pair` SQL transaction.

## Commit / restart protocol

- Every `savePair` must contain two distinct validated local account IDs and a
  stable operation ID (`[A-Za-z0-9:_-]`, 1–160 characters).
- Calls share an in-process queue and a cross-process directory lock keyed by
  save directory. Every process rechecks the pending WAL while holding that
  lock before it exposes a read or write. A crashed owner lock is reclaimed
  only after its stale timeout; active owners refresh the lock heartbeat.
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
multi-file visibility. Actual power-loss behavior depends on filesystem and OS.
Save/WAL/temp files are flushed before rename and POSIX directories are synced
afterward. Node does not expose an equivalent Windows directory fsync here, so
Windows guarantees stop at flushed file contents plus same-volume rename;
hosted crash-recovery tests do not simulate hardware cache loss.

## Save validation, backup and restore

- Loads, saves, pair entries and restores reject malformed/future schemas,
  unsafe economy integers, invalid owners, duplicate IDs and dangling
  mon/build/team/item references. Invalid input never replaces the last valid
  save; truncated JSON remains in place for diagnosis.
- Every write uses a unique same-directory temp file. Stale storage temp files
  are removed on adapter startup only after the configured age.
- New backups are versioned envelopes containing a unique ID, UTC creation
  time, account ID, SHA-256, schema version, catalog version and validated
  state. Retention defaults to the newest 20 backups per account per folder.
- Restore validates checksum and account binding before any mutation, then
  automatically creates a checked pre-restore backup in `.restore-backups`.
  If the current save is corrupt, its exact raw bytes and checksum are preserved
  in a recovery envelope before the verified replacement is committed.
  Legacy raw backups remain accepted only when their original filename begins
  with the target account ID; renamed/unverifiable legacy files fail closed.

The `package:full` script excludes `.transactions` and all player save/backup
material. This project ZIP contains the WAL implementation and synthetic tests,
**not** existing production transactions.

## Verification

`node --test tests/json-pair-journal.test.mjs tests/storage-migration.test.mjs`

Covers partial writes after the first file, failure before the first file,
commit receipt failures, same-ID retry, payload-ID conflict, concurrent callers,
manually diverged targets, corrupt journal fail-closed behavior and mixed-backend
refusal. B43 additionally runs real child processes against one save directory,
terminates a writer after its first rename, verifies restart roll-forward,
checks schema/backup/restore/retention and reclaims stale lock/temp artifacts.
It is still not a literal power cut or a guarantee for network filesystems whose
lock/rename/fsync semantics differ from the local filesystem.
