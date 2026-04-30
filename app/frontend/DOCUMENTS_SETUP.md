# Document messages setup (LOBOKO)

To enable sending **document files** (PDF, Word, Excel, ZIP) in private
messages and groups, run the SQL below **once** in the Supabase SQL editor.
It creates the `message-documents` storage bucket and the RLS policies
required for authenticated users to upload their own documents while
keeping the files publicly readable through signed storage URLs. The
statements are idempotent — re-running them is safe.

> ⚠️ Client-side, the app enforces:
> - Allowed extensions: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.zip`
> - Blocked extensions: `.exe`, `.apk`, `.bat`, `.sh`, `.js`
> - Maximum size: **25 MB**

## 1. Storage bucket + RLS

```sql
-- ============================================================
-- Bucket for document attachments in messages
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-documents', 'message-documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================
-- Policies for `message-documents`
-- ============================================================
DROP POLICY IF EXISTS "message_documents_public_read" ON storage.objects;
CREATE POLICY "message_documents_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'message-documents');

DROP POLICY IF EXISTS "message_documents_insert_own" ON storage.objects;
CREATE POLICY "message_documents_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "message_documents_delete_own" ON storage.objects;
CREATE POLICY "message_documents_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'message-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## 2. (Optional) Size limit at the bucket level

Supabase lets you set a hard size limit per bucket from the dashboard:

- Go to **Storage → message-documents → Configuration**
- Set **File size limit** to `26214400` bytes (25 MB)

The client already blocks oversized files before upload with a clear error
toast, but setting the bucket limit is a good defense-in-depth.

## 3. How it works end-to-end

1. The user opens the **paperclip** menu in a conversation and clicks the
   **Document** action rendered by `FilePicker`.
2. `FilePicker` validates the extension, blocks dangerous types
   (`.exe`, `.apk`, `.bat`, `.sh`, `.js`) and rejects files over 25 MB.
3. A `FilePreview` bubble is shown between the message list and the
   composer with a **cancel** / **send** pair.
4. On send, the file is uploaded via `uploadMediaEx(file, 'message-documents')`
   (see `src/lib/storage-helpers.ts`) and the resulting storage key is
   embedded in a `FilePayload` via `encodePayload`.
5. On the receiver side, the payload is rendered as a **FileMessage**
   bubble: icon (PDF / DOC / XLS / ZIP), filename, human-readable size,
   and a download/open button that resolves the storage key on demand.
6. Both 1-to-1 messages (`Messages.tsx`) and group chats (`GroupChat.tsx`)
   share the same component, format and bucket. Ephemeral messaging,
   starring, replying, forwarding and unread-count logic all work the
   same way as for other media.

## 4. Rollback

To fully remove the feature, simply drop the bucket:

```sql
DELETE FROM storage.objects WHERE bucket_id = 'message-documents';
DELETE FROM storage.buckets WHERE id = 'message-documents';
```

No schema migration is required: document attachments are stored as a new
`kind` inside the existing `content` column of the `messages` /
`group_messages` tables.