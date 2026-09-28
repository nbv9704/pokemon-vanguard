# B30 — Operational observability: protected diagnostics, readiness and repeatable benchmarks

Scope: **roadmap #30**, source/contract acceptance on synthetic data. This does not
replace a real production load test, a shared distributed metrics collector, a
Supabase staging migration check or mid-match PvP recovery (#18).

## Endpoints and safety

- `GET /health/live`: 200 while the HTTP process accepts requests. It intentionally
  does **not** claim storage can commit a transaction.
- `GET /health/ready`: 200 only after a read-only provider probe; 503 when not
  configured, unavailable or over the 900 ms budget. Concurrent checks share
  one probe; responses cache for 5 seconds. Public responses contain **only**
  `{"status":"ok"}` or `{"status":"unavailable"}`, with `no-store`/`nosniff`.
  HEAD behaves like GET without a body. Requests do not write a test save.
- When authenticated account mode is required, readiness checks Supabase
  configuration first, then queries only the first profile ID (`limit=1`) via
  service-role storage with a bounded request and cancellation. In Local Beta,
  it reads a reserved non-player local room name. An absent remote configuration
  is not silently declared ready when account mode is required.
- `GET /api/admin/observability` uses the existing admin authorization gate and
  `no-store`. It returns per-process room, queue, socket, runtime, settlement,
  alert, and sanitized recent-operation information. Never proxy publicly or
  forward its operational IDs to clients.
- Admin Live `/api/admin/live` retains its existing shape with extended
  `resources` (aggregate runtime, settlement, active alerts, operation counts).

## Diagnostics contract

`OperationsJournal` holds the most recent 128 sanitized events in **process memory**
(limit is configurable, hard max 1024). Each event contains only a server-generated
UUID, timestamp, one of the reviewed `domain`/`operation` names, outcome, duration,
retry count, allowlisted error code and an optional safe revision number.
Only code literals in the reviewed allowlist survive; unknown/upstream error
strings become `UNCLASSIFIED_ERROR`. No account ID, IP, request body, action
text, cookie, token, `Error.message`, `stack` or save can enter this object.
Tests inject a sentinel secret into errors and inputs and verify it does not
appear in the captured structured sink. Diagnostic `write` failures cannot
interfere with persistence.

Default is **no** stdout JSON diagnostic stream. Operators can set
`PV_OPS_JSON_LOG=true` to emit these same allowlisted one-line events; set a
bounded rotating log sink with controlled access outside Node before enabling
in production. This flag does not enable full-payload or chat logging.

Runtime metrics retain the existing p50/p95 persistence and loop-lag windows,
heap/RSS, broadcast bytes, drop counts, queue depth/oldest wait; B30 also adds
rolling persistence failures (5-minute timestamps; capped at 512), tracked
Ranked settlement pending age/retries, and derived alerts. A failed Ranked
settlement remains pending until durable retry succeeds, even after a lost ACK;
no match/player identifier appears in public health responses. Alerts cover
queue wait >15s, persistence p95 >1s (minimum 10 samples), event loop p95 >500ms
(minimum 10), settlement pending >10s, RSS >768MiB and recent persistence
errors. Thresholds are **starting diagnostic signals**, not measured SLAs.
Per-instance admin JSON is pollable by an external collector but **is not** a
multi-process aggregation service or automatic notification channel.

## Benchmark and retention

Run from `app/`:

```sh
npm run benchmark:operations -- --output /absolute/private/reports/b30-baseline.json
npm run benchmark:operations -- --compare /absolute/private/reports/b30-baseline.json --output /absolute/private/reports/b30-repeat.json
node scripts/benchmark-operations-b30.mjs --quick --output /absolute/private/reports/b30-quick.json
```

All fixture content is synthesized, never taken from `.local-data` or account
profiles. Scenarios include 16-entry small single battle, 2,000-entry large
single battle, 10,000-entry long-history double battle, broadcast to four tabs
and 20 contending pair-coordinator operations. Bench measures JSON serialize,
actual local JSON save/load with fsync, projection/encoding and pair-queue
coordination. **This does not simulate complete gameplay, a production network
or the entire SocialService**. It outputs raw times, p50/p95, warmup count,
Node/platform/CPU/RAM and SHA-256 of fixture script and catalog contract.
`--compare` rejects an incompatible fixture/catalog/script. Do not compare
absolute timings across different hardware and Node versions as an SLO.

Store benchmarks under local private reports; full/runtime package builders
exclude reports, save, backup and secrets. Use CI to compare normalized shape,
not flaky wall-clock thresholds. If an alert fires, check the operational UUID,
queue and durability status; a pending Ranked settlement calls for investigation
rather than deleting the match or retrying a non-idempotent payload.

## Tested boundaries

B30 tests cover fail-closed admin access, HTTP live/ready behavior, readiness
throttle/deadline/recovery, redacted logs, capped retention after 10,000 events,
320 synthetic contending coordinator requests, durable settlement failure +
retry, six alert triggers, benchmark repeatability and incompatible baseline
rejection. The normal full Node suite and release verifier must also pass
before this batch is distributed. Hosted CI, browser UI #22/#23, production
Supabase, multi-worker metrics and destructive recovery are **not** claimed.

## First local reference (B30, synthetic-only)

Reference JSON: `app/docs/benchmark-b30-reference.json`. Collected locally on
Linux x64, Node v22.16.0, 5 exposed CPUs; values below are development-only:

| Scenario | Synthetic bytes | Save p95 | Load p95 | Broadcast p95 |
| --- | ---: | ---: | ---: | ---: |
| Small single | 2,787 | 10.249 ms | 2.212 ms | 0.076 ms |
| Large single | 229,915 | 18.755 ms | 6.721 ms | 5.042 ms |
| Long-history double | 797,915 | 82.452 ms | 24.808 ms | 18.069 ms |

Repeat `--compare` accepted the exact same fixture/catalog/script identity.
Elapsed times changed across runs, illustrating why this is a characterization
benchmark rather than a platform-independent latency promise.
