-- LOBOKO — provider portfolio is private and served with signed URLs.
UPDATE storage.buckets SET public=false WHERE id='provider-portfolio';

DROP POLICY IF EXISTS "portfolio_bucket_owner_read" ON storage.objects;
CREATE POLICY "portfolio_bucket_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='provider-portfolio');

UPDATE storage.buckets
SET file_size_limit=10485760,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
WHERE id='provider-portfolio';
