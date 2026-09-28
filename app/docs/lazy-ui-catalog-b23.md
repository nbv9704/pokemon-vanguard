# B23 — Lazy-loaded UI and protocol catalogs

Date: 2026-09-28

## Outcome

The browser now loads UI code, route CSS, and catalog data according to the active save protocol. A fresh schema-3 session does not request the V2 catalog or legacy route assets. Legacy saves keep their existing editor, battle, recruitment, box, team, tutorial, and damage-inspector paths.

## Loading contract

- `RouteModuleRegistry` owns one promise per feature. Concurrent navigation shares the in-flight promise; a rejected optional feature does not invalidate another feature; an explicit retry creates a new attempt.
- `createCatalogLoader` owns one promise and status record per protocol version. The client chooses V3 when `trainingV3` is present and loads V2 only for legacy state.
- `createStyleLoader` is a render barrier: route CSS must emit `load` before the module is considered ready. Failed links are removed so retry can insert them again.
- The shell renders a route-scoped loading or error panel and remains connected. The retry button retries only the failed feature/catalog.
- Native `import()` remains sufficient for this codebase. No bundler or paid service was introduced.

## Route matrix

| State/route | Deferred resources |
| --- | --- |
| Fresh V3 shell | V3 catalog only |
| V3 after shell is interactive | V3 battle module and six battle styles are preloaded |
| Legacy state | Legacy core modules, seven legacy styles, and V2 catalog |
| Legacy Training damage tools | Damage inspector module and stylesheet on first use |

The legacy core includes Training, Box, Team Builder, Recruitment, V2 Battle, and V2 Tutorial. Its promise is shared across rapid route changes.

## Reproducible benchmark

Run `npm run benchmark:lazy-ui` from `app`.

The B23 lower-bound inventory avoids 15 initial requests for a fresh V3 session:

| Avoided payload | Raw | Brotli |
| --- | ---: | ---: |
| 14 directly deferred legacy JS/CSS assets | 96,025 B | 23,886 B |
| V2 catalog | 94,333 B | 6,236 B |
| Total lower bound | 190,358 B | 30,122 B |

This deliberately counts only direct assets plus the catalog. Native module dependencies reachable only from those legacy entry points make the actual avoided transfer no smaller, but are excluded to keep the result reproducible and conservative.

## Verification

- Feature-loader tests cover V3-without-V2, per-version memoization, rejected catalog retry, rapid-route deduplication, optional-module failure isolation, CSS ready barrier, and source/index architecture.
- Browser, fresh V3: Home rendered with WebSocket `ONLINE`; the network loaded the V3 catalog and V3 features, with no V2 catalog, legacy JS, or legacy CSS. Rapid Training → Pokédex → Arena navigation rendered correctly with no console warnings/errors.
- Browser, seeded legacy save with an active V1 battle: legacy Home and the live turn-1 Single Battle rendered with move controls and `ONLINE`. Opening Training loaded the damage-inspector JS/CSS only then; no console warnings/errors occurred.
- `npm run check` passes all syntax, import-boundary/cycle, lint, type, and source-structure gates.
- `npm test` is the full supported Node regression suite; its final count is recorded in the project progress journal and hosted CI run.

## Closure

All acceptance criteria for optimization item #21 are covered: fresh V3 avoids V2, active legacy battle remains usable, concurrent loads are deduplicated, and an optional module failure leaves the shell alive with an explicit retry path. Further bundling is not part of this item and should be considered only if later production measurements justify it.
