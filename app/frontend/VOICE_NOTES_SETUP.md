# Voice notes (`voice-notes` bucket) — Supabase setup

If sending a voice message fails with an error like *"Bucket \"voice-notes\" introuvable"*
or *"Permissions insuffisantes sur le bucket \"voice-notes\""*, run the SQL below
**once** in your Supabase SQL editor (Dashboard → SQL → New query):

```sql
BEGIN;

-- 1. Create the bucket (public read, 10 MB file size cap).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  10485760, -- 10 MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies on storage.objects for this bucket.
-- Public read (so the audio tag can stream the file).
DROP POLICY IF EXISTS "voice_notes_public_read" ON storage.objects;
CREATE POLICY "voice_notes_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'voice-notes');

-- Authenticated users can upload only inside their own /{user_id}/ folder.
DROP POLICY IF EXISTS "voice_notes_auth_insert_own" ON storage.objects;
CREATE POLICY "voice_notes_auth_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete / update their own files.
DROP POLICY IF EXISTS "voice_notes_auth_update_own" ON storage.objects;
CREATE POLICY "voice_notes_auth_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_notes_auth_delete_own" ON storage.objects;
CREATE POLICY "voice_notes_auth_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
```

Apply the same kind of policies to `avatars` and `posts` buckets if you
haven't yet — LOBOKO stores all media with a per-user folder prefix.

---

## How the client side works

- **Recording**: `VoiceRecorder` chooses the best codec available
  (`audio/webm;codecs=opus` on Chrome/Firefox, `audio/mp4` on Safari/iOS).
- **Upload**: `uploadMediaEx('voice-notes')` uploads the `Blob` as a `File`
  to `voice-notes/{userId}/{timestamp}-{rand}.{ext}` and returns a storage
  key of the form `voice-notes::<path>`.
- **Persistence**: the message row's `content` stores the JSON payload
  `{"kind":"audio","object_key":"voice-notes::...","duration":N}`.
- **Playback**: `VoiceMessage` resolves the key via `getMediaUrl()` (which
  uses `supabase.storage.from(bucket).getPublicUrl(path)`) and feeds the
  URL into a plain `<audio>` element.
- **Limits**: 10 MB per note, max 120 s duration (client-side).