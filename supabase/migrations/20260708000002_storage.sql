-- Private "assets" bucket. Objects live under {user_id}/... and are only
-- readable/writable by their owner; the app serves them via signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  52428800, -- 50 MB: covers hi-res stills and short mp4 clips
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
on conflict (id) do nothing;

create policy "assets objects select own" on storage.objects
  for select using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "assets objects insert own" on storage.objects
  for insert with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "assets objects update own" on storage.objects
  for update using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "assets objects delete own" on storage.objects
  for delete using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
