# B24 — Local lock fairness, modal keyboard access, strict boundary types

Date: 2026-09-28. Source baseline: uploaded B23 archive. B24 is patch-only and does not modify player saves, secret env, candidate content, or Supabase schemas.

## Account locks (#04)

`AccountCoordinator` now reserves every account claimed by an older blocked entry while scanning the pending queue. Later one-account requests cannot indefinitely overtake an older two-account operation. Independent account sets can still run concurrently, and `finally` releases all locks on both success and exception. It remains an in-process coordinator; it does **not** solve multi-process ownership, Supabase optimistic concurrency, or live PvP rehydration. Added controlled-barrier tests for overlap, overtaking, rejection cleanup and unrelated parallel work.

## Modal and storage fallback (#31)

`ModalFocusManager` is a dedicated module for client-side modal focus: preserve the opener, make `#app` inert while a modal is open, cover anchors/inputs/selects as well as buttons when wrapping Tab/Shift+Tab, return focus after closing, and use live navigation fallback when the opener is replaced by a state render. The client prioritizes modal Escape over the account menu and retains its existing close/cancel behavior. A no-focusable dialog receives `tabindex=-1` for its focus fallback. There is no layout/CSS rewrite.

`store.js` now distinguishes unreadable settings storage from malformed but readable JSON: getter exceptions flag storage as nonpersistent and trigger the existing warning. A failed setting write was already handled. Session action outboxes and authenticated identity remain unchanged.

Automated modal tests exercise keyboard wrap, inert restore, hidden controls, stale opener, repeated opens and empty dialogs. Headless Chromium smoke with isolated DOM/actual module confirmed first focus, reverse/forward Tab, anchor traversal, Escape return and inert toggle. This does **not** constitute full game browser accessibility review for keyboard traversal across routes, high-contrast/200% zoom or screen reader output.

## Type safety and broadcast (#10, #16, #25)

Strict `checkJs` now covers five more live modules: account coordinator, shared-state broadcaster, legacy public projection, WS flow control, and request quota service. JSDoc types describe socket/send callbacks, quota buckets/results, heterogeneous queued work and public allowlist output. `npm run check:types` remains the gate; it does not replace runtime input validation. A shared broadcaster now rejects an `undefined` non-serializable projection before attempting socket delivery, rather than calling `send` with an invalid frame. Nested private save values remain blocked by the existing allowlist and are still tested separately.

## Verification and remaining work

- Focused Node regression on eight directly affected test modules: **31/31 PASS**; including 6 new modal checks, 2 new concurrency cases, 1 broadcast invalid frame and 1 settings-storage failure fixture.
- `npm run check` including syntax, import/cycle, lint and strict types: PASS. Source still satisfies the structure cap.
- Broad `npm test` was attempted but stopped due to prolonged runtime. **Batches 1–3 completed with 368/368 PASS** before interruption, but no full-suite claim is made for B24. B23's hosted/full results are historical and not re-labelled as B24 verification.
- Standalone Chromium keyboard smoke: PASS. Browser full-app, multi-device interactions, multi-process concurrency, Supabase staging/production and hosted CI for this patch: NOT RUN here.

Roadmap #04, #10, #16, #25 and #31 remain `IN PROGRESS`. Other roadmap statuses and the intentional #18 deferment are unchanged.
