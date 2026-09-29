# B43 — JSON save schema, concurrency and recovery

Status: **roadmap #13 DONE** on 29/09/2026.

## Accepted contract

`JsonAdventureStorage` now treats one resolved save directory as one durability
domain. A process-local FIFO queue preserves ordering inside Node, while an
atomic `.storage.lock` directory serializes all reads, writes, backup/restore,
campaign registration and pair-WAL recovery across Node processes. Every lock
holder rechecks `.transactions/pending.json`; a process that did not create the
WAL can therefore roll it forward before returning state. The lock includes a
heartbeat, bounded acquisition and stale-owner recovery.

All single-save files, WALs, receipts and backup envelopes are created through
unique same-volume temporary files, flushed, renamed and followed by a POSIX
directory sync. Windows receives flushed file contents and same-volume rename,
but Node provides no equivalent directory fsync. This is documented as a
platform boundary rather than described as a two-file transaction.

The storage schema gate runs on load, save, each pair entry and restore. It
rejects truncated JSON, non-object roots, unsupported future versions, invalid
owners/revisions/economy balances, duplicate progression IDs, dangling
mon/build/team references and build items absent from the owned inventory when
that inventory exists. Corrupt input stays byte-for-byte in place and a failed
write cannot replace the prior valid save.

Backups use a versioned envelope with random backup ID, UTC timestamp, account
binding, SHA-256, schema/catalog versions and validated state. Retention is
bounded and configurable (20/account/folder by default). Restore verifies the
account and checksum before writing and creates a validated `.restore-backups`
safety copy of the current state. If that state is corrupt, a recovery envelope
preserves its exact raw bytes and checksum before replacement. Old raw backups
are supported only when their filename still proves the target account.

## Fault acceptance

`tests/json-storage-recovery-b43.test.mjs` covers schema and reference failures,
truncated input, injected permission/disk-write failure, stale unique temp files,
backup uniqueness/metadata/checksum/retention, wrong-account restore, tampering,
and pre-restore backup. It also launches independent Node children that commit
two pair WALs concurrently. A separate child exits with code 91 after the first
account rename; a fresh adapter reclaims the abandoned lock and rolls both
accounts plus the durable receipt forward.

Existing pair, migration, Ranked and Social recovery suites remain part of the
acceptance batch. Hosted Ubuntu and Windows CI are required before this batch is
recorded complete.

## Boundary

This closes local JSON schema/concurrency/recovery. It does not make raw readers
observe two JSON files atomically, promise persistence through dishonest disk
hardware, or certify network filesystem lock semantics. Supabase uses its own
CAS/pair transaction verified in B41. Live Ranked/Friendly match snapshot and
timer rehydration is the deliberately deferred roadmap #18, not unfinished JSON
storage work.
