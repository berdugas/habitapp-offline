-- Extend ensure_trial_entitlement so every call also flips trial -> expired
-- when trial_ends_at has passed. Today the client SELECTs first and only
-- calls this RPC on missing_row; after this migration the client will
-- ALWAYS call the RPC (see fetchTrialEntitlement task in the entitlement
-- foundation plan), making the RPC the single source of truth.
--
-- Behavior on repeat calls: the second call's UPDATE matches zero rows
-- (status is already 'expired'), so it's truly a no-op at that point.
-- The first call that does the flip will fire the trg_trial_entitlements
-- _updated_at trigger from 0005 (bumping updated_at), which is correct.
-- SECURITY DEFINER, scoped to auth.uid().

begin;

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

  -- Step 1: self-heal — insert if missing.
  insert into public.trial_entitlements (user_id, trial_started_at, trial_ends_at)
  values (v_uid, timezone('utc', now()), timezone('utc', now()) + interval '14 days')
  on conflict (user_id) do nothing;

  -- Step 2: flip-on-read — if trial elapsed and status still says trial,
  -- promote to expired so the client sees the correct status.
  update public.trial_entitlements
  set entitlement_status = 'expired'
  where user_id = v_uid
    and entitlement_status = 'trial'
    and trial_ends_at < timezone('utc', now());

  -- Step 3: return the (possibly just-updated) row.
  select * into v_row from public.trial_entitlements where user_id = v_uid;
  return v_row;
end;
$$;

-- Grant remains the same; CREATE OR REPLACE preserves it but re-asserting
-- is harmless and matches the existing migration's pattern.
grant execute on function public.ensure_trial_entitlement() to authenticated;

commit;
