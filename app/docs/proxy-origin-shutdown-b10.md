# B10 — Public origin, trusted proxy, OAuth deadlines and shutdown

Status: implemented; focused/full local tests and hosted Linux/Windows/release CI
passed on 27/09/2026 ([run 36313895556](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36313895556)).

## Deployment contract

For an HTTPS deployment, set the following values:

```dotenv
PUBLIC_ORIGIN=https://play.example.com
PV_TRUSTED_PROXY_IPS=127.0.0.1,::1
PV_OAUTH_TIMEOUT_MS=10000
PV_SHUTDOWN_TIMEOUT_MS=10000
```

`PUBLIC_ORIGIN` accepts only an HTTP(S) scheme, host, and optional port. It rejects
credentials, paths, query strings and fragments. OAuth callbacks, `Secure` cookie
selection, HTTP mutation checks and WebSocket Origin checks use this exact origin.
Request `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` cannot override it.

`PV_TRUSTED_PROXY_IPS` is an optional comma-separated list of exact IPv4/IPv6
addresses. Only a transport peer in this list may supply the first
`X-Forwarded-For` address for rate-limit accounting. List only the load balancer or
reverse proxy that connects directly to Node. CIDR and hostname entries fail
validation deliberately.

Without `PUBLIC_ORIGIN`, local development keeps the request-host fallback. Do not
use that fallback for a public reverse-proxy deployment.

## Browser request policy

- Browser POSTs for dev login, logout and admin mutations reject a non-canonical
  Origin and reject `Sec-Fetch-Site: cross-site`.
- Missing Origin/Fetch Metadata remains accepted for non-browser CLI/automation;
  endpoint authentication and authorization still apply.
- A WebSocket browser Origin must exactly match scheme, host and port. A non-browser
  WebSocket client may omit Origin.
- With HTTPS `PUBLIC_ORIGIN`, OAuth flow/session cookies use `Secure`; all auth
  cookies remain `HttpOnly; SameSite=Lax`.

## Deadlines and shutdown

OAuth token exchange and profile synchronization use `PV_OAUTH_TIMEOUT_MS`
(100–60,000 ms accepted; 10 seconds by default). Timeout errors are exposed as
`oauth_timeout` or `profile_sync_timeout`, and no session is issued.

On SIGINT/SIGTERM, the server stops accepting upgrades/connections, requests active
WebSocket closure with code 1001, drains serialized room queues, and force-closes
remaining sockets/connections when the single `PV_SHUTDOWN_TIMEOUT_MS` budget
expires. `close()` is idempotent. This is bounded single-process draining, not
multi-process match recovery.

## Verification

From `app/`:

```powershell
node --test tests/proxy-origin-b10.test.mjs tests/local.test.mjs tests/request-quotas-b08.test.mjs
npm run check
npm test
```

The focused suite covers invalid configuration, trusted/untrusted forwarded IPs,
HTTPS callback and Secure cookie generation, forged HTTP/WS origins, OAuth timeout,
local compatibility, and bounded/idempotent close. Production acceptance still
requires one real login and WebSocket connection through the configured proxy.
