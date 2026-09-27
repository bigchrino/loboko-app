-- LOBOKO — enforce server-side limits and remove duplicate public media policies.
UPDATE storage.buckets
SET file_size_limit=5242880,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
WHERE id='avatars';

UPDATE storage.buckets
SET file_size_limit=15728640,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
WHERE id IN ('posts','statuses');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "posts_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_update" ON storage.objects;
