-- =====================================================================
-- LOBOKO — Schéma complet Supabase
-- =====================================================================
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- Ce script est IDEMPOTENT : vous pouvez le relancer sans danger.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) PROFILES — profil public de chaque utilisateur
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username      TEXT NOT NULL UNIQUE,
    display_name  TEXT,
    bio           TEXT,
    metier        TEXT,
    avatar_key    TEXT,
    role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','prestataire')),
    theme         TEXT DEFAULT 'dark',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id  ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role     ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own"    ON public.profiles;

CREATE POLICY "profiles_select_all"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "profiles_delete_own"
    ON public.profiles FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 2) POSTS — publications du fil d'actualité
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content        TEXT NOT NULL DEFAULT '',
    image_key      TEXT,
    likes_count    INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    shares_count   INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all"     ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"     ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"     ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"     ON public.posts;

CREATE POLICY "posts_select_all"
    ON public.posts FOR SELECT
    USING (true);

CREATE POLICY "posts_insert_own"
    ON public.posts FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_update_own"
    ON public.posts FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "posts_delete_own"
    ON public.posts FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 3) LIKES — likes des publications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;

CREATE POLICY "likes_select_all"
    ON public.likes FOR SELECT
    USING (true);

CREATE POLICY "likes_insert_own"
    ON public.likes FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "likes_delete_own"
    ON public.likes FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Trigger: maintenir posts.likes_count à jour
CREATE OR REPLACE FUNCTION public._loboko_likes_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts
            SET likes_count = likes_count + 1
            WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts
            SET likes_count = GREATEST(0, likes_count - 1)
            WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_likes_count_ins ON public.likes;
DROP TRIGGER IF EXISTS trg_likes_count_del ON public.likes;

CREATE TRIGGER trg_likes_count_ins
    AFTER INSERT ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public._loboko_likes_count_trigger();

CREATE TRIGGER trg_likes_count_del
    AFTER DELETE ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public._loboko_likes_count_trigger();

-- ---------------------------------------------------------------------
-- 4) MESSAGES — messages directs (texte, vocal, signalisation appel)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- expéditeur
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- destinataire
    content     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender     ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver   ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pair
    ON public.messages(user_id, receiver_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_involved" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own"      ON public.messages;
DROP POLICY IF EXISTS "messages_update_receiver" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_sender"   ON public.messages;

CREATE POLICY "messages_select_involved"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        OR (SELECT auth.uid()) = receiver_id
    );

CREATE POLICY "messages_insert_own"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Le destinataire peut marquer comme lu
CREATE POLICY "messages_update_receiver"
    ON public.messages FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = receiver_id)
    WITH CHECK ((SELECT auth.uid()) = receiver_id);

CREATE POLICY "messages_delete_sender"
    ON public.messages FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 5) NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type          TEXT NOT NULL,
    post_id       UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    message       TEXT,
    read          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;

CREATE POLICY "notifications_select_own"
    ON public.notifications FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Un utilisateur connecté peut créer des notifications pour d'autres
-- (ex: un like crée une notif pour l'auteur du post).
CREATE POLICY "notifications_insert_any"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (
        from_user_id IS NULL
        OR (SELECT auth.uid()) = from_user_id
    );

CREATE POLICY "notifications_update_own"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_delete_own"
    ON public.notifications FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 6) Triggers génériques pour updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._loboko_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public._loboko_set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public._loboko_set_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;
CREATE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public._loboko_set_updated_at();

COMMIT;

-- =====================================================================
-- 7) STORAGE — À créer MANUELLEMENT via Supabase Dashboard → Storage
-- =====================================================================
-- Créez ces 3 buckets PUBLICS (cochez "Public bucket") :
--   1. avatars       (public)
--   2. posts         (public)
--   3. voice-notes   (public)
--
-- Puis exécutez le bloc ci-dessous pour poser les politiques RLS Storage
-- (une seule fois après avoir créé les buckets) :
-- =====================================================================

BEGIN;

-- AVATARS
DROP POLICY IF EXISTS "avatars_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"   ON storage.objects;

CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "avatars_owner_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "avatars_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- POSTS (images de publications)
DROP POLICY IF EXISTS "posts_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "posts_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_update"   ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_delete"   ON storage.objects;

CREATE POLICY "posts_public_read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'posts');

CREATE POLICY "posts_auth_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'posts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "posts_owner_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'posts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "posts_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'posts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- VOICE-NOTES (notes vocales)
DROP POLICY IF EXISTS "voice_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "voice_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "voice_owner_update"   ON storage.objects;
DROP POLICY IF EXISTS "voice_owner_delete"   ON storage.objects;

CREATE POLICY "voice_public_read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'voice-notes');

CREATE POLICY "voice_auth_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'voice-notes'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "voice_owner_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'voice-notes'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "voice_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'voice-notes'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

COMMIT;

-- =====================================================================
-- FIN — Votre base LOBOKO est prête.
-- =====================================================================