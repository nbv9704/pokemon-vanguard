-- B29/#28: read-only admin reporting. Apply with earlier 001/002 migrations.
-- NO anon/authenticated execute grants. These functions are called only from
-- the server using a service-role credential. Public search_path is disabled.
-- Dashboard and page use base profiles as the common population; an account
-- without game_saves contributes default zero wallet/1000 rating.
create or replace function public.admin_account_page(
 p_search text default '', p_limit integer default 50, p_offset integer default 0
)
returns table(
 user_id uuid, display_name text, avatar_url text, created_at timestamptz,
 updated_at timestamptz, schema_version integer, revision bigint,
 metrics jsonb, total bigint
)
language sql stable security definer set search_path = '' as $$
 with matches as (
  select p.user_id,p.display_name,p.avatar_url,p.created_at,p.updated_at
  from public.profiles p
  where (nullif(trim(p_search),'') is null
         or p.display_name ilike ('%'||translate(left(p_search,80),'%_','')||'%')
         or p.user_id::text = trim(p_search))
 ), counted as (select count(*) as total from matches),
 page as (select * from matches order by user_id asc limit least(100,greatest(1,p_limit)) offset least(100000,greatest(0,p_offset)))
 select p.user_id,p.display_name,p.avatar_url,p.created_at,p.updated_at,
        gs.schema_version,coalesce(gs.revision,0),
        jsonb_build_object(
          'schemaVersion',coalesce(gs.schema_version,3),
          'wallet',jsonb_build_object(
            'coins',coalesce(gs.state #> '{wallet,coins}','0'::jsonb),
            'crystals',coalesce(gs.state #> '{wallet,crystals}','0'::jsonb),
            'recruitmentTickets',coalesce(gs.state #> '{wallet,recruitmentTickets}','0'::jsonb)
          ),
          'ticketBagV1',jsonb_build_object(
            'shopTickets',coalesce(gs.state #> '{ticketBagV1,shopTickets}','0'::jsonb),
            'trainingTickets',coalesce(gs.state #> '{ticketBagV1,trainingTickets}','0'::jsonb),
            'rankTickets',coalesce(gs.state #> '{ticketBagV1,rankTickets}','0'::jsonb),
            'rankProtectionArmed',coalesce(gs.state #> '{ticketBagV1,rankProtectionArmed}','false'::jsonb)
          ),
          'rankedV1',jsonb_build_object('rating',coalesce(gs.state #> '{rankedV1,rating}','1000'::jsonb),
                                     'matches',coalesce(gs.state #> '{rankedV1,matches}','0'::jsonb)),
          'suspended',coalesce(gs.state #> '{adminV1,suspended}','false'::jsonb),
          'ownedPokemon',(select count(*) from jsonb_array_elements(
             case when jsonb_typeof(gs.state #> '{progressionV3,mons}')='array'
                  then gs.state #> '{progressionV3,mons}' else '[]'::jsonb end
            ) as mon(value) where mon.value->>'ownership'='permanent'),
          'ownedItems',jsonb_array_length(case when jsonb_typeof(gs.state #> '{progressionV3,ownedItemIds}')='array'
                  then gs.state #> '{progressionV3,ownedItemIds}' else '[]'::jsonb end)
        ),counted.total
 from page p cross join counted left join public.game_saves gs on gs.user_id=p.user_id
 order by p.user_id asc;
$$;

create or replace function public.admin_account_aggregate()
returns table(players bigint,suspended bigint,total_vp numeric,total_crystals numeric,rank_distribution jsonb)
language sql stable security definer set search_path = '' as $$
 with raw as (
  select coalesce(gs.state #>> '{adminV1,suspended}','false')='true' as is_suspended,
  case when (gs.state #>> '{wallet,coins}') ~ '^[0-9]{1,16}$'
       then (gs.state #>> '{wallet,coins}')::numeric else 0 end as vp,
  case when (gs.state #>> '{wallet,crystals}') ~ '^[0-9]{1,16}$'
       then (gs.state #>> '{wallet,crystals}')::numeric else 0 end as crystals,
  case when (gs.state #>> '{rankedV1,rating}') ~ '^[0-9]{1,6}$'
       then (gs.state #>> '{rankedV1,rating}')::integer else 1000 end as rating
  from public.profiles p left join public.game_saves gs on gs.user_id=p.user_id
 ), tiered as (
  select *,case when rating>=2400 then 'Challenger'
                when rating>=2000 then 'Master Ball'
                when rating>=1600 then 'Ultra Ball'
                when rating>=1200 then 'Great Ball' else 'Poké Ball' end as tier from raw
 )
 select count(*),count(*) filter(where is_suspended),coalesce(sum(vp),0),coalesce(sum(crystals),0),
        jsonb_build_object(
         'Poké Ball',count(*) filter(where tier='Poké Ball'),
         'Great Ball',count(*) filter(where tier='Great Ball'),
         'Ultra Ball',count(*) filter(where tier='Ultra Ball'),
         'Master Ball',count(*) filter(where tier='Master Ball'),
         'Challenger',count(*) filter(where tier='Challenger'))
 from tiered;
$$;

-- Stable keyset by immutable user_id. updated_at mutations do NOT move rows.
-- The application freezes the ID list in its immutable campaign manifest
-- before any gift is committed; only summary/IDs travel over REST.
create or replace function public.admin_gift_audience_page(
 p_after uuid default null, p_limit integer default 250, p_tier_id text default null
)
returns table(user_id uuid)
language sql stable security definer set search_path = '' as $$
 with ranked as (
  select p.user_id,case when (gs.state #>> '{rankedV1,rating}') ~ '^[0-9]{1,6}$'
     then (gs.state #>> '{rankedV1,rating}')::integer else 1000 end as rating
  from public.profiles p left join public.game_saves gs on gs.user_id=p.user_id
  where p_after is null or p.user_id>p_after
 )
 select ranked.user_id from ranked
 where p_tier_id is null or
  (case when rating>=2400 then 'challenger' when rating>=2000 then 'masterball'
        when rating>=1600 then 'ultraball' when rating>=1200 then 'greatball'
        else 'pokeball' end)=p_tier_id
 order by ranked.user_id limit least(250,greatest(1,p_limit));
$$;

revoke all on function public.admin_account_page(text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_account_aggregate() from public,anon,authenticated;
revoke all on function public.admin_gift_audience_page(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.admin_account_page(text,integer,integer) to service_role;
grant execute on function public.admin_account_aggregate() to service_role;
grant execute on function public.admin_gift_audience_page(uuid,integer,text) to service_role;
