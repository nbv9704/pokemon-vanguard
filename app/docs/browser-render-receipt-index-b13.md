# B13 — Browser render baseline and derived receipt indexes

Status: implemented and locally verified on 27/09/2026. #09 and #16 remain in
progress; this batch deliberately avoids a speculative DOM rewrite or receipt
compaction.

## Browser baseline

The project was run against an isolated temporary Local Beta save in the in-app
browser with the existing `?debug=1` render timer. Each route sample alternated
from Home to the target route ten times on the development machine.

| Route | Render p50 | Render p95 | DOM descendants after render |
| --- | ---: | ---: | ---: |
| Team Builder (`teams`) | 11.5 ms | 51.9 ms | 349 |
| Training | 2.3 ms | 3.8 ms | 109 |
| Friends | 2.3 ms | 3.8 ms | 119 |
| Arena landing | 1.6 ms | 3.8 ms | 30 |

Double Battle Team Preview rendered in 4.0 ms. The first Double Battle command
screen rendered in 6.2 ms. Twenty Battle Log show/hide redraws measured p50 2.8 ms
and p95 3.7 ms with 109 descendants.

A second authenticated local tab joined while the Team name input contained an
unsaved draft. The resulting state broadcast preserved the exact input value,
focus, caret start, and caret end. This verifies the B12 shared-frame change against
the existing render-continuity behavior.

The Team Builder has the only observed long-task-sized outlier. One outlier is not
enough evidence to replace its DOM architecture safely; browser profiling should
separate HTML generation, image decode/layout, and DOM replacement before that work.

## Derived append-only receipt indexes

The B12 benchmark showed a missing/last receipt lookup remains linear. B13 adds a
process-local `WeakMap` index for append-only persisted arrays once they contain at
least 256 entries. Smaller arrays keep the simple linear lookup. The index:

- is derived from authoritative arrays and is never serialized;
- preserves first-match behavior;
- extends incrementally after append;
- rebuilds after array replacement, truncation, or tail replacement;
- does not delete, expire, compact, or otherwise weaken a durable replay barrier.

It is used for economy ledger receipts, player action receipts, Social actions,
Admin actions, Admin Gift delivery, Ranked settlement, and V2 reward receipts.

On the same synthetic 100,000-entry fixture, missing linear lookup measured p50
2.022 ms / p95 2.678 ms. Building the index once cost 42.595 ms; subsequent
first/last/missing lookups measured at or below the timer's 0.001 ms resolution.
The cold-build cost is intentionally documented: this improves repeated command
handling, not initial load/serialization/write time.

## Verification

From `app/`:

```powershell
npm run benchmark:hot-state
node --test tests/append-only-index-b13.test.mjs tests/economy.test.mjs tests/admin-action-retry.test.mjs tests/admin-campaigns.test.mjs tests/social-receipts.test.mjs tests/ranked-recovery.test.mjs tests/ranked-v1.test.mjs tests/v2-tactical.test.mjs
npm run check
npm test
```

The focused receipt/economy/settlement suite passed 49/49 after the threshold test
was added. `npm run check` passed, and the full suite passed 1,352/1,352 on 209
test files with zero failures, skips, or todos. Hosted CI run
[`36331431485`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36331431485)
for commit `49581fd` passed on Ubuntu, Windows, and `release-smoke`.

## Remaining work

- #09 still needs a durable archive/unique-key design to reduce save bytes and write
  time without reopening already-spent action IDs.
- #16 still needs repeatable browser long-task traces for a populated Social view,
  large Bag/Team fixtures, reconnect, and real playback before partial DOM updates.
- Battle history remains unbounded in the public view. Add cursor/base revision and
  resync tests before bounding it; never drop animation events opportunistically.
