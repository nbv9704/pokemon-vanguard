create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trainer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 3,
  revision bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_save_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.bump_game_save_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists game_saves_bump_revision on public.game_saves;
create trigger game_saves_bump_revision before update on public.game_saves
for each row execute function public.bump_game_save_revision();
revoke execute on function public.bump_game_save_revision() from public;

alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.game_save_backups enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.game_saves from anon, authenticated;
revoke all on table public.game_save_backups from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.game_saves to authenticated;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their save" on public.game_saves;
create policy "Users can read their save" on public.game_saves for select to authenticated
using ((select auth.uid()) = user_id);
