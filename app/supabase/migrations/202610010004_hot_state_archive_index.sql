-- B49: archived idempotency receipts reuse the private backup table. Keep
-- action lookup indexed without exposing backup rows to browser roles.
create index if not exists game_save_backups_hot_archive_lookup_idx
on public.game_save_backups (user_id, label)
where label like 'hot-v1:%';
