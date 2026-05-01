# Monetization Setup (LOBOKO)

Run the SQL below **once** in the Supabase SQL Editor. The script is
idempotent.

It introduces the *structural* foundation for a premium subscription —
no payment is collected yet, but the frontend already ranks and badges
premium providers so the flip to paid will be a backend-only change.

```sql
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Subscription columns on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_type       TEXT        NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Enforce allowed values. DROP + ADD makes the script safe to rerun.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_type_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_subscription_type_check
       CHECK (subscription_type IN ('free', 'premium'));

-- Make sorting by "premium first then recent" cheap.
CREATE INDEX IF NOT EXISTS profiles_subscription_idx
  ON public.profiles(subscription_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. is_premium() helper — true only when premium AND not expired
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_premium(profile public.profiles)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT profile.subscription_type = 'premium'
     AND (
       profile.subscription_expires_at IS NULL
       OR profile.subscription_expires_at > NOW()
     );
$$;

COMMIT;
```

## Make a provider premium manually (for now)

```sql
-- 30-day premium grant
UPDATE public.profiles
   SET subscription_type       = 'premium',
       subscription_expires_at = NOW() + INTERVAL '30 days'
 WHERE username = 'some_provider';
```

## Notes

- Existing profiles are automatically `free` thanks to the column default —
  zero migration work required.
- When payments are added later, the only change needed is a server-side
  write to `subscription_type` / `subscription_expires_at`; the UI
  sort/badge logic is already wired.
- `is_premium()` is exposed as a SQL helper so future reports, analytics
  or edge functions can use the same definition.