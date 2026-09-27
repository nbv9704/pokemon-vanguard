# B11 — Public projection allowlists

Status: implemented; focused and full local verification passed on 27/09/2026.

## Security contract

Player-facing HTTP/WebSocket payloads are a public API. They must be constructed
from explicit allowlists; do not clone a save, session, unit, Mon, build, team, or
blueprint object and then delete known private keys. A newly added server field must
remain private until its public meaning and privacy impact have been reviewed.

`server/player-public-view.mjs` owns the legacy save-root allowlist. The local
server applies it before composing the independently projected V2/V3, economy,
mission, social, ranked, mailbox, ticket-bag, and admin-gift views. This keeps
wallet internals, action/settlement/delivery receipts, audit state, moderation
state, storage metadata, and unknown future fields out of the player payload.

V2/V3 Training and V2/V3 Battle projections also map their nested records field by
field. Returned arrays and objects are detached from authoritative state so client
mutation cannot change server state.

## Adding a public field

1. Identify the smallest DTO that owns the field. Do not add a raw save or session
   object to the root payload.
2. Add only the required scalar or a cloned/mapped nested value to that projector.
3. Add a positive assertion for the intended value and a negative sentinel
   assertion showing adjacent private and unknown fields are absent.
4. If the field is visible over WebSocket, cover the real serialized frame rather
   than testing only a helper.
5. Run the focused projection/battle tests, `npm run check`, then `npm test`.

Never restore blacklist destructuring such as `const {knownSecret, ...public} =
state`. That pattern leaks every future field by default.

## Covered surfaces

- Legacy public save root.
- V2 and V3 Training Mon, build, team, and blueprint records.
- V2 and V3 own-side live battle units.
- V3 battle preview session and both preview rosters.
- V3 opponent live units, including existing hidden-information rules.
- Real local-server WebSocket state serialization from JSON-backed storage.

Ranked, Social, Ticket Bag, Missions, Admin Gifts, and Mailbox already use dedicated
explicit projectors; their receipt privacy tests now assert behavior through the
root allowlist rather than searching server source for a blacklist.

## Verification

From `app/`:

```powershell
node --test tests/public-projection-b11.test.mjs tests/local.test.mjs tests/v3-progression.test.mjs tests/v2-progression.test.mjs tests/v2-tactical.test.mjs tests/v3-battle.test.mjs tests/v3-release.test.mjs tests/admin-action-retry.test.mjs tests/commerce-websocket-ack.test.mjs tests/ranked-v1.test.mjs tests/r3-special-battle-presentation.test.mjs
npm run check
npm test
```

The focused projection/battle suite passed 73/73. The complete suite passed
1,346/1,346 on 207 files with zero failures, skips, or TODOs.

## Remaining boundary

Authenticated Admin endpoints intentionally expose management DTOs and are not
player-public projections. Their authorization and field contracts remain separate.
Production acceptance should still include browser/network inspection through the
real proxy and account stack; this batch proves the in-process and serialized local
server contracts, not a deployed Supabase environment.
