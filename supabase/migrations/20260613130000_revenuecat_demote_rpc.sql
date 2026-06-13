-- Atomic demote helper for CANCELLATION and TRANSFER-from webhook events.
--
-- Background:
--   The Edge Function previously did SELECT -> branch -> UPDATE in two
--   round trips for CANCELLATION:
--     a) If observed status='paid' -> applyCancelRevert (atomic UPDATE
--        gated on status='paid')
--     b) If observed status!='paid' -> applyAnchorOnly (atomic UPDATE
--        advancing the anchor only)
--   That has a race window: between (a)'s failed atomic UPDATE and (b)'s
--   anchor-only UPDATE, a concurrent INITIAL_PURCHASE webhook can set
--   status='paid'. The subsequent anchor-only UPDATE then advances the
--   anchor without touching status, leaving the row permanently 'paid'
--   with an anchor newer than any future older paid event that might
--   correct it.
--
-- This RPC collapses both paths into ONE atomic statement: the
-- CASE expression decides what to set based on the row state AT SQL
-- EVALUATION TIME (not at the application's earlier SELECT time).
-- Postgres serializes the row write, so a concurrent paid event either
-- runs entirely before this UPDATE (then this UPDATE sees status='paid'
-- and demotes) or entirely after (then this UPDATE advances the anchor
-- past it and the concurrent paid event's WHERE clause rejects).
--
-- Returns one row with `applied = true` (the row matched WHERE and was
-- written) or `applied = false` (no row, or anchor already advanced).
-- Calling code that needs to distinguish those two sub-cases can do a
-- SELECT beforehand.

begin;

create or replace function public.revenuecat_demote(
  p_user_id uuid,
  p_event_at timestamptz
)
returns table (
  applied boolean,
  final_status text,
  final_anchor timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_anchor timestamptz;
begin
  with updated as (
    update public.trial_entitlements
    set
      entitlement_status = case
        when entitlement_status = 'paid' and trial_ends_at > now() then 'trial'
        when entitlement_status = 'paid' then 'expired'
        else entitlement_status
      end,
      last_revenuecat_event_at = p_event_at,
      last_validated_at = now()
    where user_id = p_user_id
      and (last_revenuecat_event_at is null or last_revenuecat_event_at < p_event_at)
    returning entitlement_status, last_revenuecat_event_at
  )
  select entitlement_status, last_revenuecat_event_at
  into v_status, v_anchor
  from updated;

  if v_status is null then
    applied := false;
    final_status := null;
    final_anchor := null;
  else
    applied := true;
    final_status := v_status;
    final_anchor := v_anchor;
  end if;
  return next;
end;
$$;

-- service_role bypasses RLS and is the only role that should invoke
-- this from the Edge Function. authenticated has no business calling
-- it (and RLS on trial_entitlements already forbids writes from that
-- role anyway).
revoke all on function public.revenuecat_demote(uuid, timestamptz) from public;
grant execute on function public.revenuecat_demote(uuid, timestamptz) to service_role;

comment on function public.revenuecat_demote(uuid, timestamptz) is
  'Atomic demote for CANCELLATION / TRANSFER-from webhook events. If the row currently shows entitlement_status=paid, demotes to trial (still in trial window) or expired (otherwise); regardless, advances last_revenuecat_event_at. Atomic against concurrent INITIAL_PURCHASE writers — see migration header for rationale.';

commit;
