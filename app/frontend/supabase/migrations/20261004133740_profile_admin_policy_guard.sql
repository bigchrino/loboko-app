-- Avoid a self-referential profiles UPDATE policy after SELECT is private.
alter policy "Admins can update verification fields" on public.profiles
  to authenticated
  using ((select loboko_private.is_profile_admin()))
  with check ((select loboko_private.is_profile_admin()));
notify pgrst,'reload schema';
