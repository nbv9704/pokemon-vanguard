create table if not exists public.game_save_operations (
  operation_id text primary key,
  fingerprint text not null,
  left_user_id uuid not null references auth.users(id) on delete cascade,
  right_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.game_save_operations enable row level security;
revoke all on table public.game_save_operations from anon, authenticated;

create or replace function public.save_game_state_pair(
  p_operation_id text,
  p_fingerprint text,
  p_left_user_id uuid,
  p_left_expected_revision bigint,
  p_left_state jsonb,
  p_right_user_id uuid,
  p_right_expected_revision bigint,
  p_right_state jsonb
)
returns table(left_revision bigint, right_revision bigint, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_fingerprint text;
  changed integer;
begin
  if p_operation_id is null or length(p_operation_id) < 1 or length(p_operation_id) > 200 or p_left_user_id = p_right_user_id then
    raise exception 'INVALID_PAIR_SAVE';
  end if;

  -- Serialize retries carrying the same id before checking the receipt table.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id,0));
  select fingerprint into existing_fingerprint from public.game_save_operations where operation_id = p_operation_id;
  if found then
    if existing_fingerprint <> p_fingerprint then raise exception 'OPERATION_PAYLOAD_CONFLICT'; end if;
    return query select l.revision,r.revision,true from public.game_saves l,public.game_saves r where l.user_id=p_left_user_id and r.user_id=p_right_user_id;
    return;
  end if;

  perform user_id from public.game_saves where user_id in (p_left_user_id,p_right_user_id) order by user_id for update;

  update public.game_saves set schema_version=coalesce((p_left_state->>'schemaVersion')::integer,3),state=p_left_state where user_id=p_left_user_id and revision=p_left_expected_revision;
  get diagnostics changed = row_count;if changed <> 1 then raise exception 'LEFT_REVISION_CONFLICT'; end if;
  update public.game_saves set schema_version=coalesce((p_right_state->>'schemaVersion')::integer,3),state=p_right_state where user_id=p_right_user_id and revision=p_right_expected_revision;
  get diagnostics changed = row_count;if changed <> 1 then raise exception 'RIGHT_REVISION_CONFLICT'; end if;

  insert into public.game_save_operations(operation_id,fingerprint,left_user_id,right_user_id) values(p_operation_id,p_fingerprint,p_left_user_id,p_right_user_id);
  return query select l.revision,r.revision,false from public.game_saves l,public.game_saves r where l.user_id=p_left_user_id and r.user_id=p_right_user_id;
end;
$$;

revoke all on function public.save_game_state_pair(text,text,uuid,bigint,jsonb,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_game_state_pair(text,text,uuid,bigint,jsonb,uuid,bigint,jsonb) to service_role;
