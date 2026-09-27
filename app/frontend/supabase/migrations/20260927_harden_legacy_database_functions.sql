-- LOBOKO — harden legacy PostgreSQL functions exposed through PostgREST.
ALTER FUNCTION public._loboko_likes_count_trigger() SET search_path = '';
ALTER FUNCTION public._loboko_set_updated_at() SET search_path = '';
ALTER FUNCTION public.bump_post_shares_count() SET search_path = '';
ALTER FUNCTION public.limit_service_requests_per_day() SET search_path = '';
ALTER FUNCTION public.provider_portfolio_enforce_limit() SET search_path = '';
ALTER FUNCTION public.increment_completed_jobs(uuid) SET search_path = '';
ALTER FUNCTION public.decrement_product_stock(uuid, integer) SET search_path = '';

-- Trigger/internal maintenance functions must not be callable as public RPCs.
REVOKE ALL ON FUNCTION public._loboko_likes_count_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._loboko_likes_count_trigger() FROM anon;
REVOKE ALL ON FUNCTION public._loboko_likes_count_trigger() FROM authenticated;
REVOKE ALL ON FUNCTION public.bump_post_shares_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_post_shares_count() FROM anon;
REVOKE ALL ON FUNCTION public.bump_post_shares_count() FROM authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_messages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_messages() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_messages() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_premium_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_self_premium_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_self_premium_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_user_admin_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_user_admin_change() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_user_admin_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Group helper functions are needed by RLS for signed-in users, but not anon.
REVOKE ALL ON FUNCTION public.is_group_admin(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_creator(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_member(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_admin(uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_creator(uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_creator(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid,uuid) TO authenticated;
