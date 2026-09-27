# B18 — Runtime persistence, queue, loop and transport observability

Status: implemented and locally verified on 28/09/2026.

## Metrics contract

The authenticated `/api/admin/live` resource snapshot and Admin Live Operations
screen now expose process-local operational metrics for:

- persistence calls: bounded recent-sample p50/p95, lifetime maximum, call count,
  and error count across single-save, pair-save, and restore operations;
- room queues: total depth and the oldest currently waiting job in milliseconds;
- event-loop delay: bounded recent-sample p50/p95 and lifetime maximum;
- current `heapUsed`, `heapTotal`, and RSS bytes;
- state broadcasts: broadcast count, successful socket deliveries, and delivered
  bytes;
- socket send drops split into backpressure, already-closed, and send-error
  reasons.

Latency distributions retain at most 512 recent samples, so metrics collection
does not itself create unbounded hot state. Lifetime counts and maxima remain
simple numbers. Public player projections do not include these metrics.

## Runtime wiring

The Hybrid storage boundary is instrumented once, which also covers Admin,
Social, Ranked, and ordinary player save paths without duplicating timers at
each caller. Persistence errors are counted and rethrown unchanged. WebSocket
send helpers report why a frame was dropped while preserving the existing
backpressure termination behavior. Shared broadcast delivery counts actual
successful bytes, not merely serialized projections.

`SerialTaskQueue` records waiting timestamps with an injectable clock and still
recovers after rejected work. The one-second event-loop sampler is unreferenced
and is cleared during graceful shutdown.

## Verification

Focused coverage passed 34/34. It includes successful and failed persistence,
bounded percentile snapshots, controlled queue wait, broadcast byte accounting,
drop reasons, aggregate privacy, Admin UI contracts, room capacity/reload, and
real local WebSocket/server paths. `npm run check` passed. Full regression passed
1,371/1,371 on 214 supported test files with zero failures, skips, or todos.
Hosted CI is recorded in the progress log after completion.

## Remaining boundaries

- Metrics reset with the process and are not exported to a shared time-series
  backend; multi-process aggregation and alerting remain deployment work.
- No long-duration production-like load/soak or real Supabase latency run has
  been performed.
- Ranked settlement-pending age is not yet a dedicated aggregate.

For those reasons roadmap item #30 remains in progress rather than being marked
complete. Distributed socket admission also remains under #10.
