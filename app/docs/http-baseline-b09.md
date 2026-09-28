# B09 public catalog payload baseline (development fixture)

Command: `node scripts/benchmark-http-public.mjs`.
Run environment: Node v22.16.0, Linux container, 3 warmup + 10 sampled iterations.
Payload inputs: reviewed public V2 and active public V3 server catalogs (no user content).

| Payload | JSON (bytes) | gzip (bytes) | Brotli (bytes) | JSON serialization p50 / p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| V2 | 48,979 | 6,703 | 5,464 | 0.199 / 2.211 |
| V3 | 909,342 | 108,789 | 78,438 | 3.250 / 7.490 |

The original HTTP route serialized on **every request**, the B09 helper serializes each
public catalog **once at startup** and precompresses gzip/Brotli variants. End-to-end
network timing, browser decompression/render, peak memory impact and production p95 were
not measured in B09. B22 adds repeatable loopback cold/warm byte and timing evidence plus
a live browser/WebSocket smoke in `http-runtime-acceptance-b22.md`; it is still not a
production SLA. Re-run on the target machine under identical conditions and record JSON output.
