# Supabase Storage asset release — B45

Status: deployment tooling complete and locally/browser verified. Production activation remains deliberately blocked until the existing redistribution-rights gate passes and the project owner creates the public bucket. No database migration is required for this feature.

## What the release command guarantees

- Reads `public/asset-manifest.json` and verifies every local byte before any network write.
- Uses `releases/sha256-…/` as an immutable object prefix. Existing objects are never overwritten (`x-upsert: false`).
- Uploads 1,495 runtime-media objects first and `asset-manifest.json` last. Documentation such as `public/assets/ui/README.md` is excluded.
- Downloads all 1,496 public objects again and verifies length plus SHA-256 before printing `PUBLIC_ASSET_BASE_URL`.
- Keeps `SUPABASE_SECRET_KEY` only in server-side request headers. New `sb_secret_…` keys are sent through `apikey`, never incorrectly as a bearer JWT; legacy service-role JWTs remain compatible. Public verification requests never carry either key.
- Refuses deployment while `npm run assets:rights:release` fails. Do not bypass this gate merely because a source URL is publicly reachable.

Supabase public buckets allow unauthenticated reads and are CDN cached, while upload/delete operations remain protected. Release paths are never reused because CDN/browser invalidation is not instantaneous.

## One-time bucket setup

1. In Supabase Dashboard, open **Storage → New bucket**.
2. Name it `pokemon-vanguard-assets`.
3. Enable **Public bucket**. Do not add anonymous upload/update/delete policies.
4. Set a file-size limit of at least 2 MiB. The current largest object is below that, but re-run `npm run assets:release:plan` after future asset changes.
5. Allow the MIME types used by the manifest: `image/png`, `image/gif`, `image/svg+xml`, `image/jpeg`, `image/webp`, `font/woff2`, and `application/json`. `application/octet-stream` is no longer required by the runtime release.

Create the bucket through the Storage Dashboard/API, not by editing `storage.buckets` manually. Supabase documents the managed `storage` schema as read-only for object operations.

## Prepare and deploy

Run from `app/` in a temporary PowerShell session. Never commit or paste the secret key into browser code, screenshots, logs, or `PUBLIC_ASSET_BASE_URL`.

```powershell
$env:SUPABASE_URL='https://YOUR_PROJECT_REF.supabase.co'
$env:SUPABASE_SECRET_KEY='YOUR_SERVER_SECRET_KEY'
$env:PV_ASSET_BUCKET='pokemon-vanguard-assets'

npm run assets:release:plan
npm run assets:rights:release
npm run assets:supabase:deploy
```

The second command is expected to fail until the remaining rights inventory is reviewed. The deploy command runs the same gate again before making a network write.

After a successful deploy, copy only the printed public value into the application runtime environment:

```text
PUBLIC_ASSET_BASE_URL=https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/pokemon-vanguard-assets/releases/sha256-...
```

Restart the application server. `/api/assets/config` will publish the public base URL without exposing any key. Keep the local asset files in the application release as the tested rollback/fallback path.

## Verify, monitor, and roll back

Remote verification requires no secret because the bucket is public:

```powershell
$env:SUPABASE_URL='https://YOUR_PROJECT_REF.supabase.co'
$env:PV_ASSET_BUCKET='pokemon-vanguard-assets'
npm run assets:remote:verify
```

Check Storage usage and egress in the Supabase Dashboard after a real traffic sample; no plan is assumed unlimited. Confirm browser requests return the intended `Cache-Control` and, where exposed, CDN cache status.

Rollback is configuration-only: remove `PUBLIC_ASSET_BASE_URL` and restart the game server. The client immediately returns to checked-in local paths. Do not delete the remote release during rollback; retain old release prefixes for clients that already loaded their configuration. Delete a release only through the Storage API after a separately reviewed retention decision.

## Release update procedure

1. Change or add local assets.
2. Run `npm run assets:manifest` and review the new release hash.
3. Run the full check/test batch and the rights gate.
4. Deploy the new immutable prefix and complete full remote verification.
5. Change `PUBLIC_ASSET_BASE_URL` to the newly printed URL.
6. Keep the previous release available through the agreed retention window.

Never overwrite an object inside an existing release prefix. This avoids stale CDN/browser content and makes rollback deterministic.
