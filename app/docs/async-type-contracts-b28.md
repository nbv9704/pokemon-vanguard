# B28 — Close optimization #25: executable contracts at critical boundaries

## Scope and non-goals

This batch closes the **planned lint/type-contract gate** for the currently reviewed
command, result, save-port, public DTO and browser wire boundaries. It does **not**
claim that all older JavaScript modules are statically typed or that typed data
replaces runtime validation. Storage implementations' complete internal objects
and historical save shapes remain covered by the independent persistence/migration
work under #13; database staging and multi-process transaction guarantees belong
to #02/#05, not #25.

## Production paths actually covered

- `tsconfig.contracts.json` continues strict `checkJs` for durable receipt command,
  serial queue, coordinator, public projection, broadcast, WS flow-control and
  quotas, and now includes compile-only **positive and negative** TypeScript
  assertions for discriminated `CommandOutcome`, a typed `StoragePort`, reviewed
  mutations and browser ACK DTO. Negative `@ts-expect-error` examples become CI
  errors if these contracts weaken enough to accept malformed samples.
- `server/storage-port.mjs` is strict-checked and `createLocalServer()` asserts the
  complete shared storage facade at bootstrap, including `savePair`. This is a
  non-cloning identity assertion, not a transaction adapter or extra IO. The
  local, cloud and hybrid backends' **method existence** is guarded at runtime;
  it would be false to claim their entire internals are now checkJs-clean.
- `tsconfig.browser-contracts.json` independently strict-checks the actual browser
  `net.js` and authored Shop action constructor, with DOM types separated from
  Node production checking. Incoming state/error/action-ack envelopes are
  discriminated and checked **before** notifying the UI. Invalid action ACKs
  cannot clear the action pending outbox. The state view remains an opaque
  versioned payload, not a trusted SaveState; nested validation stays per-view.
- The Shop screen constructs `shopV3.buy` through a strongly typed builder and
  refuses malformed item ID, payment and action ID instead of queuing it.
  Server-side validation continues to accept intentionally supported legacy
  defaults, independent of this browser convenience check.
- `scripts/verify-contract-negative-gates-b28.mjs` proves that the **actual**
  type-aware ESLint CI configuration rejects an unawaited Promise and that the
  import boundary gate rejects a browser→server dependency. The temporary
  malformed fixtures are synthetic and always removed; the test runner's
  `--stdin` mode was intentionally avoided because typed lint obtains its
  program from on-disk source.

## Run and acceptance

From `app/`: `npm run check` checks strict Node/browser types, normal ESLint,
negative gates, syntax, imports/cycles and all content/release/asset validation.
Focused regression:

```
node --test --test-concurrency=4 \
 tests/commerce-websocket-ack.test.mjs tests/commerce-retry.test.mjs \
 tests/social-receipts.test.mjs tests/storage-boundary-b08.test.mjs \
 tests/storage-migration.test.mjs tests/shop.test.mjs \
 tests/ticket-bag-integration.test.mjs tests/ticket-bag.test.mjs \
 tests/net-reliability-b06.test.mjs tests/type-contract-gates-b28.test.mjs \
 tests/client-modules.test.mjs tests/receipt-command-handler.test.mjs
```

No player data, secret, existing save or migration was modified. Source packaging
must continue excluding caches, local data, dependency trees and reports.

## Follow-up outside #25

- #13: full save schema/migration, power-loss and cross-process storage recovery.
- #22/#23: real desktop browser image/CSS acceptance and art-rights review.
- #02/#05: actual cloud migrations, full Supabase transaction smoke testing.
- Additional static typing for other modules is welcome if changes are driven by
  concrete risk; it is not the completion condition for these critical gates.
