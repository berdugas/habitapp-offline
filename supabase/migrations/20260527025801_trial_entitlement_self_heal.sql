-- Trial entitlement self-heal: defends against silent failures of the
-- handle_new_user trigger from 0005. One iOS beta tester observed a
-- missing trial_entitlements row for a confirmed fresh signup, which
-- pushed the client into read_only mode and showed the "Reconnect to
-- keep logging" banner. Server logs were not available to diagnose why
-- the trigger failed, so we add a strictly additive defense:
--   1. ensure_trial_entitlement() RPC the client calls on missing_row.
--   2. One-shot backfill catching the affected tester plus any
--      pre-migration accounts in the shared dev project.

begin;

-- 1. Idempotent self-heal RPC. Always operates on auth.uid() — clients
-- cannot impersonate another user. SECURITY DEFINER so it can insert
-- past the (intentionally restrictive) RLS write policy. ON CONFLICT
-- DO NOTHING makes repeat calls a no-op.
create or replace function public.ensure_trial_entitlement()
returns public.trial_entitlements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.trial_entitlements;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.trial_entitlements (user_id, trial_started_at, trial_ends_at)
  values (v_uid, timezone('utc', now()), timezone('utc', now()) + interval '14 days')
  on conflict (user_id) do nothing;

  select * into v_row from public.trial_entitlements where user_id = v_uid;
  return v_row;
end;
$$;

grant execute on function public.ensure_trial_entitlement() to authenticated;

-- 2. Backfill: any auth.users row without a corresponding
-- trial_entitlements row gets one. Uses auth.users.created_at as
-- trial_started_at so the 14-day window starts from the original
-- signup time, not from when this backfill ran. Some old accounts
-- may have already burned through their trial period as a result —
-- that's correct behavior.
insert into public.trial_entitlements (user_id, trial_started_at, trial_ends_at)
select
  u.id,
  coalesce(u.created_at, timezone('utc', now())),
  coalesce(u.created_at, timezone('utc', now())) + interval '14 days'
from auth.users u
left join public.trial_entitlements t on t.user_id = u.id
where t.user_id is null;

commit;
