# B39 — State delta, cursor resync and route-aware rendering

Status: **roadmap #16 DONE** on 29/09/2026.

## What changed

- `createDeltaStateBroadcaster()` keeps a per-socket full-view baseline. A negotiated client receives one full `state` frame on join, reconnect or resync, then shallow top-level domain patches with `baseCursor` and `cursor`.
- Projection is still pure and audience-scoped. Tabs with the same audience share the projected object and, when their baseline/cursor matches, the same serialized frame.
- The server sends a full frame whenever a delta would be at least 90% of that frame. Failed sends do not advance the socket baseline.
- Delta is capability-gated with `state-delta-v1`. Older clients keep receiving full snapshots only.
- The browser validates cursor adjacency, safe keys, exact `changedKeys === patch + removed` metadata and bounded key counts. A gap requests one `resync`; the next full snapshot replaces the baseline.
- The UI keeps battle, Ranked, Friendly PvP and playback on the existing full-render path. For a delta unrelated to the active route it updates only the resource bar, connection status and notification badges. The existing focus/caret/scroll capture remains the fallback for route-dependent redraws.

The protocol is deliberately a top-level domain delta, not an arbitrary JSON Patch. Every value still comes from the reviewed public projector and a full snapshot remains the recovery authority.

## Repeatable synthetic benchmark

Command: `npm run benchmark:state-delta`. The fixture contains 272 Pokémon, 600 builds, 100 friends, 141 bag items and 800 Double Battle events. Each scenario runs 40 samples on Node v22.15.0 / Windows x64. CPU compares full JSON encoding with delta comparison/encoding/dispatch; both exclude domain projector construction.

| Scenario | Full bytes | Delta bytes p50 / p95 | Reduction | Full CPU p50 / p95 | Delta CPU p50 / p95 | Reconnect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Idle/no changed domain | 264,659 | 91 / 91 | 99.97% | 1.000 / 1.427 ms | 2.407 / 3.747 ms | full |
| Chat/presence | 264,659 | 13,825 / 13,825 | 94.78% | 1.018 / 1.305 ms | 2.515 / 4.290 ms | full |
| Bag ticket | 264,659 | 19,262 / 19,262 | 92.72% | 0.971 / 1.289 ms | 2.397 / 4.469 ms | full |
| Team name | 264,659 | 120,811 / 120,811 | 54.35% | 0.912 / 1.248 ms | 2.649 / 4.532 ms | full |
| Double Battle event | 264,659 | 111,942 / 112,716 | 57.41–57.70% | 0.949 / 1.246 ms | 2.729 / 5.893 ms | full |

The exact local rerun is authoritative; values above are rounded from the B39 acceptance run. The delta path deliberately spends roughly 1.4–4.7 ms extra CPU at p95 in this large synthetic fixture to reduce wire bytes and browser redraw. Socket backpressure/drop accounting remains in the bounded-send and runtime-metrics path introduced earlier.

## Render and continuity evidence

B13 established the pre-delta browser baseline: Team p50/p95 **11.5/51.9 ms**, Training/Friends **2.3/3.8 ms**, Arena **1.6/3.8 ms**, Double preview **4.0 ms**, command **6.2 ms**, and Battle Log **2.8/3.7 ms**. B39 does not pretend those route-dependent render costs disappeared. It removes the full route render entirely for unrelated deltas; battle/playback deltas still use the measured safe path.

Real in-app-browser acceptance used two tabs against an isolated temporary save. While the first tab had the Box team-name field focused with `B39 focus continuity` and the caret at 20, the second tab joined and caused a presence broadcast. Afterwards the first tab retained the same value, focused element, caret position and scroll position. Both tabs stayed online and reported no console warning/error. The temporary save and tabs were removed after the check.

## Regression coverage

- shared full/delta serialization for two same-audience tabs;
- full snapshot after an explicit broadcaster reset;
- malformed, unsafe, duplicate or mismatched patch metadata rejection;
- ordered delta application, no-op redraw suppression and cursor-gap resync;
- route-aware chrome patching versus battle/playback full rendering;
- real WebSocket capability negotiation, full join, delta broadcast, resync and legacy full-only compatibility;
- existing playback freshness/order and render-continuity source contracts.

## Boundaries

- Deltas are per-process and per-socket; this does not add distributed room ownership (#10/#18).
- No deep diff is attempted. Large domains intentionally fall back to a full frame when that is cheaper or safer.
- A route-dependent state change can still redraw route content; further component-level `mount/update/unmount` work is optional UX optimization, not required for the accepted #16 contract.
- B39 does not change persistence, Supabase migrations, battle rules, action ordering or the meaning of an ACK.
