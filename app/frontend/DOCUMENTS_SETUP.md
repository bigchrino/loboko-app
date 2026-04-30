# Document messages setup (LOBOKO) — **private bucket edition**

To enable sending **document files** (PDF, Word, Excel, ZIP) in private
messages and groups, run the SQL below **once** in the Supabase SQL editor.

> ⚠️ **Security model**
>
> - The bucket is **private** — files are **never** reachable through a
>   public URL.
> - The client requests a **short-lived signed URL** (60 seconds) only at
>   the moment the user clicks "Ouvrir".
> - Row Level Security (RLS) restricts `SELECT` on `storage.objects`:
>   only participants of the message (DM sender/receiver, or group
>   member) can obtain a signed URL. If the user does not have access,
>   the `createSignedUrl` call itself fails and the UI shows "Accès
>   refusé".
> - Uploads are restricted to the owner's own folder
>   (`auth.uid()::text/…`), so a user cannot upload into another user's
>   namespace.
> - The client also validates the MIME type against the extension
>   (a renamed `.exe → .pdf` is rejected before upload).
>
> **If you previously created this bucket as public, run step 1 anyway
> — it will toggle `public = false` on the existing bucket.**

## Client-side enforcement (already implemented)

- Allowed extensions : `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.zip`
- Allowed MIME types : `application/pdf`, `application/msword`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  `application/vnd.ms-excel`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `application/zip` (+ common zip aliases)
- Blocked extensions : `.exe`, `.apk`, `.bat`, `.sh`, `.js`
- Blocked MIME prefixes : `application/x-msdownload`, `application/x-dosexec`,
  `application/x-sh`, `application/javascript`, `text/html`, …
- Max size : **25 MB**

## 1. Private bucket

```sql
-- Create the bucket as PRIVATE, or flip it to private if it already exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-documents', 'message-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;
```

## 2. Row Level Security policies

Drop any previous public-read policy and install access-controlled ones.
`auth.uid()` is the current authenticated user. The path convention is
`<owner_uid>/<filename>` (see `uploadMediaEx` in `storage-helpers.ts`).

The `SELECT` policy grants access to:

1. **The uploader itself** (`owner/...` = `auth.uid()/...`).
2. **DM participants**: a row exists in `public.messages` with this
   object as a `file` attachment, and `auth.uid()` is sender or receiver.
3. **Group members**: a row exists in `public.group_messages` with this
   object as a `file` attachment, and `auth.uid()` is an active member
   of that group.

Because messages store the file reference as the string
`message-documents::<path>` inside `content` (JSON payload with
`"object_key": "message-documents::<path>"`), we can match by
substring on `name` (the path inside the bucket).

```sql
-- Remove any legacy policies so we start clean.
DROP POLICY IF EXISTS "message_documents_public_read" ON storage.objects;
DROP POLICY IF EXISTS "message_documents_select_participants" ON storage.objects;
DROP POLICY IF EXISTS "message_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "message_documents_delete_own" ON storage.objects;

-- --------------------------------------------------------------
-- INSERT: a user can only upload into their own folder.
-- --------------------------------------------------------------
CREATE POLICY "message_documents_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- --------------------------------------------------------------
-- DELETE: only the uploader can delete their own files.
-- --------------------------------------------------------------
CREATE POLICY "message_documents_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'message-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- --------------------------------------------------------------
-- SELECT (read / createSignedUrl): owner, DM participants,
-- or active group members only.
-- --------------------------------------------------------------
CREATE POLICY "message_documents_select_participants" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'message-documents'
  AND (
    -- 1) The uploader
    (storage.foldername(name))[1] = auth.uid()::text

    -- 2) DM participant (sender or receiver) of a message that
    --    references this object as a file attachment.
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.content LIKE '%"object_key":"message-documents::' || name || '"%'
        AND (m.user_id = auth.uid() OR m.receiver_id = auth.uid())
    )

    -- 3) Active member of the group that received this file.
    OR EXISTS (
      SELECT 1
      FROM public.group_messages gm
      JOIN public.group_members me
        ON me.group_id = gm.group_id
       AND me.user_id = auth.uid()
      WHERE gm.content LIKE '%"object_key":"message-documents::' || name || '"%'
    )
  )
);
```

> ℹ️ The `LIKE '%"object_key":"message-documents::' || name || '"%'`
> pattern is the safe way to join `storage.objects.name` (which is just
> the path inside the bucket) with our encoded key
> `"message-documents::<path>"` stored inside the JSON payload. It
> avoids full-text parsing and plays nicely with the GIN index that
> Supabase maintains on `storage.objects.name`.

## 3. (Optional) Bucket-level size limit

Supabase lets you set a hard size limit per bucket from the dashboard:

- Go to **Storage → message-documents → Configuration**
- Set **File size limit** to `26214400` bytes (25 MB)

The client already blocks oversized files before upload with a clear
toast, but setting the bucket limit is good defense-in-depth.

## 4. (Optional) Bucket-level MIME allow-list

In the same configuration pane, set **Allowed MIME types** to:

```
application/pdf
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/zip
application/x-zip-compressed
```

The client already enforces this, but having Supabase reject mismatched
MIME types at upload time catches bad clients as well.

## 5. End-to-end flow

1. User clicks the paperclip, then **Document**. `FilePicker` validates
   the extension **and the MIME type** against the allow-list and
   rejects blocked types (`.exe`, `.apk`, `application/x-msdownload`, …).
2. Upload goes to `message-documents/<auth.uid()>/<random>.<ext>` via
   `uploadMediaEx`. RLS rule (2) allows this only in the caller's own
   folder.
3. The message payload stores the key as
   `"message-documents::<auth.uid()>/<random>.<ext>"`.
4. On the receiver side, `FileMessage` renders a card with icon + name +
   size. **No URL is fetched at render time.**
5. When the user clicks **Ouvrir**, `getSignedStorageUrl(key, 60)` asks
   Supabase for a signed URL that lives 60 seconds. RLS rule (3) checks
   that the caller is a DM participant or an active group member of the
   message referencing this file. If not, `createSignedUrl` returns an
   error and the UI shows "Accès refusé à ce fichier."
6. The browser opens the signed URL in a new tab. It expires shortly
   after.

## 6. Rollback

To fully remove the feature:

```sql
DELETE FROM storage.objects WHERE bucket_id = 'message-documents';
DELETE FROM storage.buckets WHERE id = 'message-documents';
```

No schema migration is required: document attachments are stored as a
`kind: 'file'` payload inside the existing `content` column of the
`messages` / `group_messages` tables.