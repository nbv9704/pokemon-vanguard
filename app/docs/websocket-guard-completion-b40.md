# B40 — WebSocket resource-guard acceptance

Status: **roadmap #10 DONE** on 29/09/2026.

## Accepted contract

The public WebSocket path now has a tested bound at every in-process admission layer:

| Boundary | Default / behavior | Failure |
| --- | --- | --- |
| Upgrade rate | 30/IP/minute | HTTP 429 + retry hint |
| Concurrent sockets | 24/IP, 4/account | HTTP 429 or close 1013 |
| Join deadline | 12 seconds | close 4000 |
| Incoming payload | 70 KiB transport maximum | close 1009 before JSON/action parsing |
| Per-socket pending work | 32 messages | close 1013 |
| Message/action rate | socket, account and IP token buckets | `ACTION_RATE_LIMITED` + `retryAfterMs` |
| Buffered outgoing bytes | 8 MiB | terminate slow consumer and count backpressure drop |
| Room residency | 1,000 with safe detached LRU/TTL | HTTP 503 when no safe room can be evicted |

`PV_WS_MAX_SOCKETS_PER_IP`, `PV_RATE_ACCOUNT_ACTIONS_10S`, `PV_RATE_IP_ACTIONS_10S`, `PV_RATE_SOCKET_MESSAGES_10S`, `PV_RATE_IP_UPGRADES_MIN` and the existing shutdown/room controls remain startup-configurable and clamped. Forwarded IP headers are trusted only through the canonical proxy policy from B10.

B39 supplies ordered state cursor/resync. A slow consumer is disconnected instead of letting frames accumulate; reconnect receives a full authoritative snapshot. The server does not selectively discard action acknowledgements or battle events.

## Real transport acceptance

`tests/websocket-guard-acceptance-b40.test.mjs` starts only isolated temporary local servers and removes their saves afterward. It proves:

- an unjoined socket expires with 4000;
- exactly four joined tabs remain healthy and a fifth account socket closes with 1013;
- resource counters report four connected, zero pending and zero queued;
- one malformed frame returns the stable `invalid json` error;
- a 1,000-frame malformed burst reaches the 32-message queue bound and closes only the noisy socket;
- another account receives its pong within three seconds during that flood;
- a 71 KiB frame closes with 1009 before application parsing;
- existing token-bucket, backpressure, room-capacity and state-resync suites remain green.

This is a local safety/load fixture, never a request against a deployed service.

## Repeatable synthetic benchmark

Run `npm run benchmark:websocket-guards`. Windows / Node v22.15.0 acceptance result:

| Scenario | Attempts | Accepted/bounded result | Time |
| --- | ---: | ---: | ---: |
| Pending queue flood | 100,000 | 32 | 4.247 ms |
| Token-bucket flood | 100,000 | 70 | 32.229 ms |
| Slow consumer | n/a | terminated above 8,388,608 B | immediate |
| Four same-audience tabs | 4 | one 250,099 B full encoding; one shared 122 B delta encoding | n/a |

The run reported about 592 KiB heap growth while retaining the intentionally full 32-entry queue and benchmark objects. Absolute timings and heap allocation vary; the asserted invariants are the fixed acceptance counts, isolated-account admission, slow-consumer termination and one projection/shared frame per audience.

## Boundaries

- These are per-process application guards. Cross-worker/global connection ownership belongs to the deferred distributed/restart design in #18 and to deployment proxy infrastructure, not to #10.
- This does not claim DDoS protection, WAF behavior or a production traffic SLO.
- Limits should be tuned only from production telemetry; raising them requires keeping a finite clamp and rerunning this acceptance suite.
