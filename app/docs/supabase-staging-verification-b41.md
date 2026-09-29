# B41 — Supabase transaction and RLS verification

Status: **roadmap #05 DONE** on 29/09/2026.

## Scope

`npm run verify:supabase-staging` exercises the Supabase project configured in
the ignored `app/.dev.vars`. It requires an explicit `--live` flag internally,
never prints keys or the project URL, and uses a non-browser user agent for the
server secret. Legacy service-role JWTs use an Authorization header; current
`sb_secret_...` keys are sent only through `apikey`.

The verifier creates two random, confirmed Auth users whose emails, display
names, operation IDs and campaign ID carry a unique `b41` marker. It deletes
the campaign and both Auth users in `finally`; foreign keys cascade their
profiles, saves and pair-operation receipts. Cleanup failure fails the run.
No existing profile or player save is selected for mutation.

## Accepted live checks

The configured hosted project passed all of these checks:

1. An authenticated fixture can select its own profile but receives no row for
   the other fixture. Anonymous table access is denied. Authenticated profile
   writes, pair-save RPC execution and admin aggregate RPC execution are denied.
2. Two storage clients load the same revision. The first CAS write commits;
   the stale writer receives `STORAGE_REVISION_CONFLICT`, and its state is not
   stored.
3. `save_game_state_pair` commits both saves together. Retrying the same
   operation and fingerprint returns `duplicate: true`; reusing the operation
   ID with another payload is rejected without changing either save.
4. A forced conflict on the second ordered account proves transaction rollback:
   the first update made earlier inside the RPC is rolled back, while the
   independent winning write remains.
5. `admin_account_page`, `admin_account_aggregate` and
   `admin_gift_audience_page` execute with the server role and return validated
   shapes.
6. An Admin Gift campaign can be registered/read by the server role and cannot
   be read by anon or either authenticated fixture.
7. Campaign and Auth-user cleanup completes successfully.

This is direct runtime evidence for migrations
`202609260001_atomic_pair_saves.sql`,
`202609260002_admin_campaign_identity.sql` and
`202609280003_admin_reporting.sql`, in addition to the base account schema.

## Boundaries

- The check validates database transaction and RLS behavior; it does not claim
  cross-process in-memory account coordination (#04), durable session
  revocation (#11), local JSON power-loss semantics (#13), or active PvP match
  recovery (#18).
- The verifier deliberately uses tiny isolated fixtures. It is not a database
  load test or permission to run against an unrelated project.
- Server secrets remain ignored local configuration and must never be placed in
  browser code, logs, CI artifacts or source control.

Supabase's current key guidance is documented at
<https://supabase.com/docs/guides/getting-started/api-keys>; RLS behavior is
documented at <https://supabase.com/docs/guides/database/postgres/row-level-security>.
