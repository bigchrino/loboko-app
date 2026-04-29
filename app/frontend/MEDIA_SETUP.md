# Media Setup (LOBOKO)

To enable photo/video sending in messages and publications, run the following
SQL in the **Supabase SQL editor** once. It creates the required storage
buckets (`avatars`, `posts`, `message-media`) and the Row Level Security
policies for them, and adds a `video_key` column on `posts` for video
publications. The statements are idempotent: re-running them is safe.

## 1. Storage buckets + RLS

```sql
-- ============================================================
-- Buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================
-- Policies for `avatars`
-- ============================================================
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- Policies for `posts`
-- ============================================================
DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
CREATE POLICY "posts_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "posts_insert_own" ON storage.objects;
CREATE POLICY "posts_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "posts_delete_own" ON storage.objects;
CREATE POLICY "posts_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- Policies for `message-media`
-- ============================================================
DROP POLICY IF EXISTS "message_media_public_read" ON storage.objects;
CREATE POLICY "message_media_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'message-media');

DROP POLICY IF EXISTS "message_media_insert_own" ON storage.objects;
CREATE POLICY "message_media_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "message_media_delete_own" ON storage.objects;
CREATE POLICY "message_media_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'message-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## 2. Add `video_key` column on posts

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_key text;
```

## 3. Check / create the bucket from the UI (optional)

If any bucket is missing, go to **Supabase > Storage > Buckets** and create it
with the same id (`avatars`, `posts`, `message-media`) and toggle **Public**.

Once this SQL is executed, photo & video sending will work in Messages,
publications, and profile avatars.