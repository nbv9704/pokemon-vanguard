# B22 HTTP cache/runtime acceptance

This batch closes roadmap item 20. It verifies the B09 public HTTP implementation
against the acceptance criteria in `docs/project-optimization-audit-2026-09-26.md`.

## Contract covered

| Requirement | Implementation and evidence |
| --- | --- |
| Serialize public catalogs once | `createCatalogHttpResponse` prepares identity, gzip and Brotli buffers when the server is created. |
| ETag, conditional GET and HEAD | Catalog and static tests cover 200/304, matching ETags and empty HEAD/304 bodies. |
| Safe static policy | Fingerprinted names are immutable; HTML and unversioned JS/CSS revalidate; binary images are not recompressed. |
| Private data is never shared-cacheable | The real `/api/auth/session` route returns `Cache-Control: no-store`; auth/save/admin routes do not use the public cache helper. |
| Encoding negotiation | Weighted `Accept-Encoding`, gzip, Brotli, identity and 406 behavior are covered by the B09 regression suite. |
| Bounded memory and streaming | Small compressible static entries use the bounded LRU; large files and images stream from disk. Traversal and symlink escape tests remain in the suite. |
| Catalog invalidation | A changed catalog payload produces a different content ETag and a request carrying the old ETag receives 200 with the new body. |
| Live runtime compatibility | A real local server serves a Brotli catalog and 304 responses while a WebSocket joins and receives authoritative state. |

## Repeatable commands

```text
npm run benchmark:http-runtime
node --test tests/http-cache-b09.test.mjs tests/http-cache-runtime-b22.test.mjs
npm run check
npm test
```

`benchmark:http-runtime` uses a temporary save directory and deletes it during
shutdown. It measures bytes received on the HTTP socket, so a 304 must report zero
body bytes. The script fails if encoding, 304, private no-store or WebSocket
contracts regress.

## Local Windows baseline

Environment: Windows, Node v22.15.0, 10 warm samples, local loopback.

| Request | Result |
| --- | --- |
| Cold V3 catalog, Brotli | 200; 78,438 wire bytes; 24.074 ms |
| Warm V3 catalog | 304; 0 total body bytes across 10 samples; p50 1.601 ms; p95 1.923 ms |
| Cold `/` | 200; Brotli; 564 wire bytes; 24.144 ms |
| Warm `/` | 304; 0 total body bytes across 10 samples; p50 2.128 ms; p95 3.599 ms |
| Private session | 200; `Cache-Control: no-store` |
| WebSocket handshake | 11.031 ms |

These loopback timings are reproducible development evidence, not a production SLA.
Compare runs on the same target and configuration rather than treating them as an
internet latency guarantee.

## Browser smoke

The in-app browser entered a temporary local-beta session, rendered the Home route,
reported `ONLINE`, then completed a warm reload with the same authenticated session.
The browser console contained no warnings or errors. This confirms that the cache
rules do not break bootstrap, session handling or the live WebSocket path.

## Completion decision

All item-20 implementation and acceptance criteria are now automated or recorded:
cold/warm requests, request bytes/time, 304, invalidation, HEAD, gzip/Brotli,
private no-store, streaming and live browser/WebSocket behavior. Item 20 is `DONE`.
