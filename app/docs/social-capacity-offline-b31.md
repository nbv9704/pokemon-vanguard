# Social capacity, profile identity and pair-commit contract (B31)

## Enforced behavior

- Friend requests validate both sides while locking both account IDs. A full
  recipient or sender cannot receive/send another request. Crossed requests
  return `REQUEST_ALREADY_RECEIVED` rather than storing inconsistent duplicates;
  the recipient uses the existing incoming request to accept.
- Accept must find both the incoming and matching outgoing request. Capacity is
  rechecked **under the same two-account lock** immediately before committing.
  If one side would exceed 100 friends, both saves and both requests stay intact;
  no partial success is broadcast. Concurrent accepts sharing an account serialize.
- A durable pair writer is mandatory. Social no longer falls back to two
  independent writes when an adapter omits `savePair`. JSON uses its pair WAL,
  cloud uses its pair-transaction RPC. `SOCIAL_ATOMIC_STORAGE_REQUIRED` fails
  before any live state mutation or notification.
- Action IDs and receipts remain durable: retry after commit/lost ACK must
  reuse the original ID. An already mutual friendship returns an idempotent
  success for legacy repeated accepts, without creating duplicate friend rows.
- Profile lookups for offline accounts read durable public profile fields
  (`displayName`, `avatarUrl`) instead of a disconnected socket session.
  Online self-actions use the current authenticated session. Durable offline
  fields are cached for 30 s in at most 256 entries per process. Registering or
  unregistering a socket invalidates that account's cached profile. A profile
  returned for a different `userId` fails closed; no private profile payload is
  copied into cached/published Social entries. The cache does **not** authorize
  writes, and its TTL is not a cross-worker coherence guarantee.
- Removing a friend retains the previous B30 product behavior: both accounts
  lose friendship and their in-save conversation history; the UI confirms this
  before sending. B31 does not add chat archive or moderation retention.

## Evidence and limits

Synthetic JSON + account-coordinator tests exercise 98→100, 99→100, 100
capacity denial, two simultaneous accepts, replay/deduplication, missing
reciprocal request, pair writer failure, live-vs-durable identity, bounded
profile cache, mismatched profile rejection and HTML escaping. Existing
signed WebSocket + mocked Supabase RPC lost-ACK tests protect the end-to-end
handshake. Check and full regression status are recorded in both synchronized
optimization progress files.

**Production prerequisites:** The two-account coordinator is per process.
Run all accounts needing shared locks on one owner or implement distributed
coordination (#04). Cloud transaction/RLS migration 001-003 and live staging
checks remain under #05. This B31 result is **not** a claim of real Supabase
staging, cross-worker consistency, browser/assistive-technology acceptance,
chat-data backup retention or public release approval.
