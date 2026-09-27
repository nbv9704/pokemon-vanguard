# B17 — Bounded room lifecycle and resource observability

Status: implemented and locally verified on 28/09/2026.

## Runtime contract

The process now has two complementary room reclamation paths:

- normal TTL cleanup keeps a detached room for ten minutes by default;
- capacity cleanup removes the least-recently-active safe detached room when a
  new account would exceed `PV_MAX_RESIDENT_ROOMS` (default `1000`).

A room is safe to remove only when it has no connected or joining sockets, its
serial queue is empty, its live state is not dirty, and neither Ranked nor
Friendly PvP still references that account. Both paths also clear the account's
in-process Ranked, Friendly, and Social presence. A later connection reloads the
durable save.

If the limit is full and every resident room is active, queued, dirty, or owned
by PvP, the new WebSocket upgrade receives HTTP `503` with `Retry-After: 5`.
Existing rooms and sessions remain available. The server never evicts an active
room merely to satisfy the cap.

## Observability

Authenticated admins receive a `resources` object from `/api/admin/live` with:

- resident/max, active/detached, dirty, and PvP-busy room counts;
- connected and joining socket counts;
- queued room jobs;
- cumulative TTL and capacity evictions;
- cumulative capacity rejections.

Only aggregate counters are exposed; account and room identifiers are absent.
`createLocalServer().resourceSnapshot()` exposes the same object for integration
tests and local diagnostics. The Admin Live Operations screen renders the same
room, socket, queue, eviction, and rejection counters as resource cards.

## Verification

Focused tests cover every non-eviction guard, TTL cleanup, deterministic LRU
ordering, aggregate privacy, active-cap rejection, detached capacity eviction,
and durable reload after two successive evictions. The focused server/admin
group passed 28/28 and `npm run check` passed. Full regression and hosted CI are
recorded in the project progress log after completion. Full local regression
passed 1,370/1,370 across 213 supported test files with zero failures, skips, or
todos. Hosted CI is green for commit `e4cb74a`: Ubuntu, Windows, and
`release-smoke` passed in
[run 36336206506](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36336206506).

## Remaining boundaries

- The cap and counters are process-local. Multi-process admission and presence
  need a shared coordinator and remain tracked under distributed WebSocket/PvP
  work.
- These resource counters do not yet include persistence latency, event-loop
  lag, heap usage, or slow-consumer totals, so observability item #30 remains in
  progress.
