-- Apply BEFORE deploying resumable Admin Gift campaigns to Supabase.
-- The authenticated client has no access; server service role owns campaign identity.
create table if not exists public.admin_gift_campaigns (
  campaign_id text primary key check (length(campaign_id) between 1 and 128 and campaign_id ~ '^[A-Za-z0-9:_-]+$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  audience jsonb not null check (jsonb_typeof(audience) = 'array'),
  gift jsonb not null check (jsonb_typeof(gift) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.admin_gift_campaigns enable row level security;
revoke all on public.admin_gift_campaigns from public, anon, authenticated;
grant select, insert on public.admin_gift_campaigns to service_role;
-- No client-facing RLS policies. Only the server-side service role may read/write.
