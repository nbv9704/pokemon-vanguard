# B05 — Player retry / commit ACK contract

## What is covered

`server/v3-player-actions.mjs` applies Schema-3 Training and Team mutations to a clone,
checks existing `actionReceipts` by stable `actionId` before evaluating expected
revision, then returns one result state containing both progression/economy changes
and its receipt. Callers persist that state before swapping the live room state.
Legacy no-ID actions still execute but do **not** receive cross-restart dedupe.

For ID-bearing `buildV3.save`, `teamV3.save`, `teamV3.activate` and
`replicaV3.apply`, retry exactly the **same action ID and payload**. Never create a
new ID merely because the client did not receive a response; reload/check the
receipt first. Using the same ID for a different payload returns
`ACTION_ID_REUSED`. Training payments may have a separate ledger entry, but the
outer action receipt prevents reapplying the whole mutation on retry.

`local-server.mjs` sends a WebSocket frame
`{"type":"action-ack","actionId":"...","actionType":"...","duplicate":false}`
only after persistence succeeds for covered Social and Schema-3 management
actions. A generic `state` or presence update is **not** a commit ACK. If storage
fails after committing but before publishing the result, retry with the same ID;
the server consults durable storage to establish whether it already committed.

## Browser Social outbox

`social-pending-actions.js` keeps at most one Social action per account/browser
tab, in sessionStorage when available. The UI exposes **Retry same action** and
**Discard pending**. It deliberately does not resend automatically on reconnect
or reload. An ACK clears the pending entry only when the `actionId` matches.
An associated definite server error is displayed but does not silently discard
uncertain pending intent. Discard can leave an action on the server if it was
already committed; UI requests user confirmation. Browser data storage may be
blocked, in which case retry state does not survive reload and a warning is shown.

## Testing

Run `node --test tests/v3-player-action-retry.test.mjs tests/v3-player-websocket-retry.test.mjs tests/social-pending-actions.test.mjs tests/social-websocket-ack.test.mjs`.
`npm run check` and `npm test` verify release correctness. Social cloud fault
injection uses a **mock** pair-save RPC; it is not a production Supabase test.

## Still open

A common envelope and committed ACK for all gameplay commands, archival of
permanent receipts without reopening entitlements, true mid-match PvP restart
recovery, browser QA, actual Supabase migration/smoke and multi-process HA.
