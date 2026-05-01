# LOBOKO — Marketplace Features Setup

This document contains the SQL to create the **Réalisations**, **Demandes de service**, **Réponses** and **Favoris** tables required by the new marketplace phase.

All statements are **idempotent** — safe to re-run.

---

## 1) Run the SQL

Copy–paste the block below in the Supabase SQL editor (or psql) and run it.

```sql
-- =====================================================================
-- LOBOKO — marketplace features (works / requests / favorites)
-- =====================================================================

-- ---------- Table: provider_works ------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_works (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  category_id uuid REFERENCES public.services_categories(id) ON DELETE SET NULL,
  city        text,
  media_key   text NOT NULL,
  media_type  text NOT NULL CHECK (media_type IN ('image','video')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_works_created_at
  ON public.provider_works (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_works_user
  ON public.provider_works (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_works_category
  ON public.provider_works (category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_works_city
  ON public.provider_works (city, created_at DESC);

ALTER TABLE public.provider_works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "works_read_all"   ON public.provider_works;
DROP POLICY IF EXISTS "works_insert_own" ON public.provider_works;
DROP POLICY IF EXISTS "works_update_own" ON public.provider_works;
DROP POLICY IF EXISTS "works_delete_own" ON public.provider_works;

CREATE POLICY "works_read_all"   ON public.provider_works FOR SELECT USING (true);
CREATE POLICY "works_insert_own" ON public.provider_works FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "works_update_own" ON public.provider_works FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "works_delete_own" ON public.provider_works FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------- Table: service_requests ----------------------------------
CREATE TABLE IF NOT EXISTS public.service_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES public.services_categories(id) ON DELETE SET NULL,
  city        text,
  budget      text,
  is_urgent   boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status_created
  ON public.service_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_user
  ON public.service_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_category
  ON public.service_requests (category_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_city
  ON public.service_requests (city, status, created_at DESC);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_read_all"   ON public.service_requests;
DROP POLICY IF EXISTS "requests_insert_own" ON public.service_requests;
DROP POLICY IF EXISTS "requests_update_own" ON public.service_requests;
DROP POLICY IF EXISTS "requests_delete_own" ON public.service_requests;

CREATE POLICY "requests_read_all"   ON public.service_requests FOR SELECT USING (true);
CREATE POLICY "requests_insert_own" ON public.service_requests FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "requests_update_own" ON public.service_requests FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "requests_delete_own" ON public.service_requests FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------- Table: service_request_responses -------------------------
CREATE TABLE IF NOT EXISTS public.service_request_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message      text NOT NULL,
  price_offer  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_request_responses_request
  ON public.service_request_responses (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_responses_provider
  ON public.service_request_responses (provider_id, created_at DESC);

ALTER TABLE public.service_request_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responses_read_all"   ON public.service_request_responses;
DROP POLICY IF EXISTS "responses_insert_own" ON public.service_request_responses;
DROP POLICY IF EXISTS "responses_delete_own" ON public.service_request_responses;

CREATE POLICY "responses_read_all"   ON public.service_request_responses FOR SELECT USING (true);
CREATE POLICY "responses_insert_own" ON public.service_request_responses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = provider_id);
CREATE POLICY "responses_delete_own" ON public.service_request_responses FOR DELETE TO authenticated
  USING ((select auth.uid()) = provider_id);

-- ---------- Table: favorites -----------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('provider','work','service')),
  target_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_type
  ON public.favorites (user_id, type, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_read_own"   ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;

CREATE POLICY "favorites_read_own"   ON public.favorites FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "favorites_insert_own" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "favorites_delete_own" ON public.favorites FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
```

---

## 2) Anti-spam (client-side, enforced also in code)

- Max **5 demandes de service / 24h / utilisateur** — vérifié avant `insert`.
- Un client peut **fermer** sa demande (`status = 'closed'`).

## 3) Notes

- `favorites.target_id` est un **texte** : il supporte un `uuid` (prestataire / réalisation) comme une `slug` (service).
- L'index `(user_id, type)` garantit des requêtes légères.
- Les pages `/works`, `/requests`, `/favorites` utilisent la pagination (20 items, `range()`), le lazy loading images/vidéos, et **aucun autoplay vidéo**.