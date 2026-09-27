-- LOBOKO — enforce server-side limits for private/sensitive storage.
UPDATE storage.buckets
SET file_size_limit=10485760,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]
WHERE id='kyc-documents';

UPDATE storage.buckets
SET file_size_limit=26214400,
    allowed_mime_types=ARRAY['application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip']::text[]
WHERE id='message-documents';

UPDATE storage.buckets
SET file_size_limit=15728640,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
WHERE id='message-media';

UPDATE storage.buckets
SET file_size_limit=10485760,
    allowed_mime_types=ARRAY['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a']::text[]
WHERE id='voice-notes';
