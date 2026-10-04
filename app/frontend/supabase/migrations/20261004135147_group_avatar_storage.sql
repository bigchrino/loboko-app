-- Group avatars are private. Uploads precede group creation, so paths
-- remain scoped to the uploader; members can read the group's current photo.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('group-avatars','group-avatars',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy group_avatars_read_authorized on storage.objects for select to authenticated
using (
 bucket_id='group-avatars'
 and exists(select 1 from public.profile_directory p where p.user_id=(select auth.uid()))
 and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or exists(select 1 from public.groups g where g.deleted_at is null
   and g.avatar_key='group-avatars::'||objects.name
   and public.is_group_member(g.id,(select auth.uid())))
 )
);
create policy group_avatars_insert_own on storage.objects for insert to authenticated
with check (
 bucket_id='group-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profile_directory p where p.user_id=(select auth.uid()))
);
create policy group_avatars_update_own on storage.objects for update to authenticated
using (
 bucket_id='group-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profile_directory p where p.user_id=(select auth.uid()))
)
with check (
 bucket_id='group-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profile_directory p where p.user_id=(select auth.uid()))
);
create policy group_avatars_delete_own on storage.objects for delete to authenticated
using (
 bucket_id='group-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profile_directory p where p.user_id=(select auth.uid()))
);
