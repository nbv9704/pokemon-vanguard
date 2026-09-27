# B12 — Hot-state and broadcast baseline

Status: synthetic baseline and same-audience broadcast coalescing implemented on
27/09/2026. Local verification and hosted Linux, Windows, and release CI passed
([run 36326764392](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36326764392)).
This batch does not compact durable receipts or change browser rendering.

## Decision

Do not truncate economy ledgers, action receipts, settlement receipts, delivery
receipts, or claim tombstones. They are part of duplicate-payment and duplicate-
reward protection. A safe compaction requires a durable archive/index migration
with uniqueness preserved across the hot/archive boundary.

B12 makes one bounded optimization that does not change the wire contract: when a
room has multiple sockets for the same audience (normally several tabs of one
account), the server builds and serializes that state frame once and reuses the
encoded string for those sockets. Different player/role keys still receive
separately projected frames. Spectators are rejected before owner-only projectors
run. Slow-consumer termination remains active for the reused frame.

This does not reduce bytes sent on the network and does not optimize a single-tab
session. It removes repeated projection/serialization CPU work inside one broadcast.

## Repeatable benchmark

Run from `app/`:

```powershell
npm run benchmark:hot-state
```

The script creates isolated synthetic state, writes it to a temporary JSON storage
directory, and deletes that directory afterward. It never reads `.local-data` or a
real player save. Results below are Windows, Node v22.15.0; five serialization
samples. They are development-machine baselines, not production SLOs.

| Synthetic entries per unbounded branch | Total save | Serialize p50 / p95 | Durable JSON write | Missing receipt lookup p50 / p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 1,692,922 B | 8.077 / 8.737 ms | 43.421 ms | 0.026 / 0.071 ms |
| 10,000 | 7,431,117 B | 29.027 / 38.137 ms | 144.544 ms | 0.074 / 0.151 ms |
| 100,000 | 65,263,022 B | 258.149 / 261.540 ms | 1,446.791 ms | 1.590 / 1.642 ms |

At 100,000 entries, the measured branches were economy ledger 30,777,782 B,
action receipts 21,477,781 B, and battle events 11,946,577 B. The Social fixture is
held at the existing 100 conversations × 100 messages and remains 1,058,061 B at
all three scales.

## Same-audience broadcast comparison

The synthetic comparison uses four tabs with one audience and the current
unbounded battle-history shape.

| Battle events / frame bytes | Per-socket projection p50 / p95 | Shared frame p50 / p95 | Projection/serialization count |
| ---: | ---: | ---: | ---: |
| 1,000 / 117,537 B | 8.944 / 9.010 ms | 2.361 / 2.611 ms | 4 → 1 |
| 10,000 / 1,184,732 B | 90.166 / 93.309 ms | 21.805 / 22.030 ms | 4 → 1 |
| 100,000 / 11,946,637 B | 1,014.269 / 1,068.737 ms | 244.529 / 245.476 ms | 4 → 1 |

Absolute timings vary by machine. The invariant under test is one projection and
one serialization per unique audience rather than per socket.

B13 extended this benchmark with the derived append-only receipt index. At 100,000
entries, a missing linear lookup measured p50/p95 2.022/2.678 ms. The one-time index
build measured 42.595 ms; repeated lookups were at or below 0.001 ms resolution.
See `browser-render-receipt-index-b13.md` for the threshold and correctness contract.

## Verification and boundaries

Focused tests cover shared/different audiences, exact serialized-frame reuse,
slow-consumer termination, real local WebSocket behavior, spectator protection,
and B11 privacy projection. The focused suite passed 14/14; `npm run check`
passed; the full suite passed 1,348/1,348 on 208 files with zero failures,
skips, or TODOs. Run:

```powershell
node --test tests/state-broadcast-b12.test.mjs tests/local.test.mjs tests/public-projection-b11.test.mjs
npm run check
npm test
```

GitHub-hosted Ubuntu and Windows validation plus the clean-package
`release-smoke` job passed for commit `bfe641b`.

Still required before #09 or #16 can be marked done:

- Design a hot/archive receipt store whose unique operation keys remain durable;
  test replay attempts before and after migration/retention boundaries.
- Add battle event cursors and full resync before bounding public history. Never
  drop turn-animation events merely to reduce frame size.
- Measure real browser render/long tasks for idle, chat, Bag, Team edit, Double
  Battle, and reconnect. This batch does not claim a browser render improvement.
- Run multi-process/Supabase and production-like soak tests; the current sharing is
  deliberately in-process and per broadcast invocation.
