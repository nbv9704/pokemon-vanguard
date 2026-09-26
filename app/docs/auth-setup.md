# Supabase Auth and save setup

Pokémon Vanguard uses Supabase Auth for Google and Discord identities. The local Node server completes the PKCE exchange, stores the game session in an HttpOnly cookie, and keeps provider tokens out of browser JavaScript.

## Supabase dashboard

Enable Google and Discord under **Authentication → Sign In / Providers**. Both provider consoles must use the callback URL shown by Supabase:

`https://<project-ref>.supabase.co/auth/v1/callback`

Under **Authentication → URL Configuration**, set:

- Site URL: `http://localhost:3100`
- Redirect URL: `http://localhost:3100/auth/callback`

Add the production HTTPS callback later without removing the local callback.

## Database

Open the Supabase SQL Editor and run [`supabase/migrations/202609210001_vanguard_accounts.sql`](../supabase/migrations/202609210001_vanguard_accounts.sql). It creates private player profiles, authoritative JSON saves, revision tracking, migration backups, and read-only RLS access for each signed-in user.

The browser cannot create or modify game saves. Only the trusted game server writes progression through the Supabase secret key.

## Local environment

Copy `.dev.vars.example` to `.dev.vars` and fill in:

- `AUTH_SESSION_SECRET`: at least 32 random bytes.
- `SUPABASE_URL`: Project URL from Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: safe browser/public project key, used by the server for OAuth exchange.
- `SUPABASE_SECRET_KEY`: server-only secret key. Never expose or commit it.
- `AUTH_ALLOW_LOCAL_BETA`: keep `true` for local testing; set `false` in production.

Google and Discord client secrets stay in the Supabase dashboard and do not belong in `.dev.vars`.

Restart `npm run dev` after changing `.dev.vars`. OAuth users use Supabase save storage. The Local Beta option continues to use `.local-data` so existing development saves remain intact.
