-- Lightweight inbox previews: never transfer attachment bodies or video posters.
create or replace function public.group_inbox_preview(raw text)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare payload jsonb;
begin
  if left(raw, 9) = '@@loboko:' then
    begin
      payload := substring(raw from 10)::jsonb;
      if jsonb_typeof(payload) = 'object' and payload ? 'kind' then
        return '@@loboko:' || jsonb_build_object(
          'kind', payload->>'kind',
          'text', left(payload->>'text', 240),
          'file_name', left(payload->>'file_name', 120)
        )::text;
      end if;
    exception when invalid_text_representation then
      null;
    end;
  end if;
  return left(raw, 240);
end;
$$;
revoke all on function public.group_inbox_preview(text) from public, anon;
grant execute on function public.group_inbox_preview(text) to authenticated;

-- The caller's existing table RLS policies remain in force. No supplied user ID.
create or replace function public.load_group_inbox()
returns table (
  group_data jsonb, member_count bigint, last_message jsonb,
  last_read_at timestamptz, unread_count bigint
)
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(g), members.total,
    case when latest.id is null then null else jsonb_build_object(
      'id', latest.id, 'group_id', latest.group_id, 'user_id', latest.user_id,
      'content', public.group_inbox_preview(latest.content),
      'created_at', latest.created_at,
      'deleted_for_everyone_at', latest.deleted_for_everyone_at,
      'expires_at', latest.expires_at
    ) end,
    reads.last_read_at, unread.total
  from public.group_members mine
  join public.groups g on g.id = mine.group_id and g.deleted_at is null
  left join public.group_reads reads on reads.group_id = g.id and reads.user_id = mine.user_id
  cross join lateral (
    select count(*) as total from public.group_members m where m.group_id = g.id
  ) members
  left join lateral (
    select m.id, m.group_id, m.user_id, m.content, m.created_at,
      m.deleted_for_everyone_at, m.expires_at
    from public.group_messages m
    where m.group_id = g.id and (m.expires_at is null or m.expires_at > now())
    order by m.created_at desc, m.id desc limit 1
  ) latest on true
  cross join lateral (
    -- 100 is sufficient for the inbox's 99+ badge; don't scan an entire history.
    select count(*) as total from (
      select 1 from public.group_messages m
      where m.group_id = g.id and m.user_id <> mine.user_id
        and m.deleted_for_everyone_at is null
        and (m.expires_at is null or m.expires_at > now())
        and (reads.last_read_at is null or m.created_at > reads.last_read_at)
      order by m.created_at desc limit 100
    ) pending
  ) unread
  where mine.user_id = (select auth.uid())
  order by coalesce(latest.created_at, g.created_at) desc, g.id;
$$;
revoke all on function public.load_group_inbox() from public, anon;
grant execute on function public.load_group_inbox() to authenticated;
