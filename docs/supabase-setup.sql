create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
revoke all on table public.app_state from anon;
grant select, insert, update, delete on table public.app_state to authenticated;

drop policy if exists "users read their own app state" on public.app_state;
create policy "users read their own app state"
on public.app_state for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users create their own app state" on public.app_state;
create policy "users create their own app state"
on public.app_state for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users update their own app state" on public.app_state;
create policy "users update their own app state"
on public.app_state for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users delete their own app state" on public.app_state;
create policy "users delete their own app state"
on public.app_state for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snoopy-photos',
  'snoopy-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users read their own photos" on storage.objects;
create policy "users read their own photos"
on storage.objects for select
to authenticated
using (bucket_id = 'snoopy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users upload their own photos" on storage.objects;
create policy "users upload their own photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'snoopy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users update their own photos" on storage.objects;
create policy "users update their own photos"
on storage.objects for update
to authenticated
using (bucket_id = 'snoopy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'snoopy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users delete their own photos" on storage.objects;
create policy "users delete their own photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'snoopy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;

