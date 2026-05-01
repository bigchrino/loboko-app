# Moderation Setup (LOBOKO)

Run the SQL below **once** in the Supabase SQL Editor. The script is
idempotent — running it multiple times has no side effect.

It creates:

- `public.reports` table — user-submitted reports against other users,
  messages, posts or statuses.
- A generated `target_type` column (`profile` / `message` / `post`) so
  admins can filter by target kind without branching on nullability.
- A **unique constraint** on `(reporter_id, target_type, target_id)` to
  prevent a single user from spamming the same target.
- RLS policies — users can only create reports and see their own;
  profiles flagged with `is_admin = true` can see / update everything.
  Deletion is disabled for everyone, so moderation history is never lost
  even if the reported content itself is removed.
- A helper column `profiles.is_admin` (boolean, default false) used by
  the admin policies and the in-app moderation page.

```sql
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. is_admin flag on profiles (used by RLS below and by the admin UI)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. reports table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_message_id UUID,
  reported_post_id    UUID,
  reason              TEXT NOT NULL CHECK (reason IN (
                        'inappropriate', 'scam', 'spam', 'harassment', 'other'
                      )),
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  CHECK (
    reported_user_id    IS NOT NULL
    OR reported_message_id IS NOT NULL
    OR reported_post_id    IS NOT NULL
  ),
  -- Exactly one target must be set — prevents mixed-target rows.
  CHECK (
    (CASE WHEN reported_user_id    IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN reported_message_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN reported_post_id    IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

-- Derived columns make spam prevention + admin filtering trivial.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS target_type TEXT GENERATED ALWAYS AS (
    CASE
      WHEN reported_user_id    IS NOT NULL THEN 'profile'
      WHEN reported_message_id IS NOT NULL THEN 'message'
      WHEN reported_post_id    IS NOT NULL THEN 'post'
    END
  ) STORED;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS target_id UUID GENERATED ALWAYS AS (
    COALESCE(reported_user_id, reported_message_id, reported_post_id)
  ) STORED;

-- Max 1 report per (reporter, target) — hard anti-spam at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_target
  ON public.reports(reporter_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS reports_reporter_idx      ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx        ON public.reports(status);
CREATE INDEX IF NOT EXISTS reports_target_type_idx   ON public.reports(target_type);
CREATE INDEX IF NOT EXISTS reports_created_at_idx    ON public.reports(created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own"   ON public.reports;
DROP POLICY IF EXISTS "reports_select_own"   ON public.reports;
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
DROP POLICY IF EXISTS "reports_no_delete"    ON public.reports;

-- Any authenticated user can create a report where they are the reporter.
-- status is forced to 'pending' to prevent pre-approved self-reports.
CREATE POLICY "reports_insert_own"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_at IS NULL
  );

-- Users see their own reports (to know they were submitted).
CREATE POLICY "reports_select_own"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid()));

-- Admins see every report.
CREATE POLICY "reports_select_admin"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.is_admin = TRUE
    )
  );

-- Only admins can update status.
CREATE POLICY "reports_update_admin"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.is_admin = TRUE
    )
  );

-- Nobody can DELETE reports through the API: no policy => denied.
-- (Explicit comment — RLS defaults deny when no policy matches.)

-- ---------------------------------------------------------------------------
-- 4. Prevent users from self-granting premium
-- ---------------------------------------------------------------------------
-- Even with an `is_admin` flag, we also protect the subscription columns
-- via a trigger so a user editing their own profile row CANNOT change
-- `subscription_type` or `subscription_expires_at`. Those columns are
-- writable only by service_role (backend / admin SQL).
CREATE OR REPLACE FUNCTION public.prevent_self_premium_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role / superuser (no auth.uid()) to change anything.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_type IS DISTINCT FROM OLD.subscription_type THEN
    RAISE EXCEPTION
      'subscription_type can only be changed by the backend/admin';
  END IF;

  IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
    RAISE EXCEPTION
      'subscription_expires_at can only be changed by the backend/admin';
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION
      'is_admin can only be changed by the backend/admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_premium_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_premium_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_premium_change();

COMMIT;
```

## Promote a user to admin

To let a user access `/admin/reports`, mark their profile row as admin.
This must be executed in the SQL editor (service role) — the trigger
above blocks `is_admin` updates from the app.

```sql
UPDATE public.profiles
   SET is_admin = TRUE
 WHERE username = 'your_admin_username';
```

## Grant premium to a provider

Same rule — must be run in the SQL editor / backend only:

```sql
UPDATE public.profiles
   SET subscription_type       = 'premium',
       subscription_expires_at = NOW() + INTERVAL '30 days'
 WHERE username = 'some_provider';
```

## Notes

- `target_type` + `target_id` are `GENERATED ALWAYS AS ... STORED`, so
  they stay in sync with whichever `reported_*` column is set. The app
  code doesn't need to write them.
- The unique index `(reporter_id, target_type, target_id)` is the hard
  anti-spam guard: a second insert for the same target returns a
  duplicate-key error that the UI maps to a friendly "déjà signalé"
  message.
- Reports are never auto-deleted or auto-moderated — admins decide.
- Deletion of reports is denied at the RLS layer (no policy matches),
  so moderation history survives even if the offending user or message
  is purged.
- The `prevent_self_premium_change` trigger closes the loophole where a
  user with a valid session could PATCH their own profile row with
  `subscription_type = 'premium'`: that write now raises at the DB
  level. Backend scripts using the `service_role` key bypass it because
  `auth.uid()` is NULL under that role.