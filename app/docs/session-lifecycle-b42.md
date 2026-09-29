# B42 — durable session lifecycle and revocation

Status: **roadmap #11 DONE** on 29/09/2026.

## Runtime contract

- A session still has a random SID, a signed expiry and strict
  provider/account/player/room binding. Legacy valid cookies derive a stable
  hash-based SID as before.
- Logout stores only `SHA-256(SID) -> expiry` in
  `<saveDir>/.auth/session-revocations.json`. The file uses mode-restricted
  creation, temp-file + fsync + rename, and an exclusive cross-process lock.
  Expired entries are pruned on write; 100,000 live entries is a hard fail-closed
  ceiling rather than an unsafe eviction policy.
- HTTP authentication and WebSocket upgrade consult the durable journal.
  Connected sockets are swept once per second, so a logout in one server
  instance closes the same session on another instance with code 4001.
- Each queued WebSocket message is revalidated. An AsyncLocalStorage context
  follows the admitted session through Ranked, Social, Admin and ordinary
  player calls. Instrumented `save`, `savePair` and `restore` perform one final
  fresh session check immediately before the storage mutation. Expiry or
  revocation at that boundary throws `AUTH_EXPIRED`/`AUTH_REVOKED`; no write or
  ACK occurs.
- If the revocation journal cannot be read, locked or written, authentication
  fails closed. Logout still clears the browser cookie and returns HTTP 503 so
  it never falsely promises cross-process revocation.

## Acceptance evidence

`tests/session-lifecycle-b42.test.mjs` proves:

1. journal visibility after adapter restart;
2. four real child processes can add revocations concurrently without losing
   entries or persisting raw SIDs;
3. storage writes remain zero when expiry/revocation happens after action
   admission but before commit;
4. journal failure denies authentication and produces a 503 logout with an
   expired cookie;
5. logout on server A closes a joined socket on server B and a fresh server C
   rejects the old cookie after restart.

`npm run verify:session-supabase` additionally creates one isolated Supabase
Auth UUID, joins through a real cloud-backed game save, logs out through another
server instance, observes cross-server socket closure, restarts the server and
confirms the cookie remains rejected. The Auth user and cascaded save are then
deleted; cleanup failure fails the verifier.

## Deployment boundary

This completes the supported single-host/multi-process Node deployment: all
workers must share the same durable `saveDir`. Multi-host orchestration without
a shared filesystem still belongs to the distributed ownership/deployment work
tracked by #04/#18; B42 does not claim a global Redis service, Supabase session
table or provider-wide token revocation. No Supabase migration is introduced.
