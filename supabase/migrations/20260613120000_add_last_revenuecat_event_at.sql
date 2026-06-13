-- Add per-row idempotency anchor for the RevenueCat webhook handler.
-- The Edge Function compares incoming event.event_timestamp_ms against
-- this column and rejects (200 no-op) any event older-or-equal to the
-- last applied one. Protects against:
--   - Late delivery of an earlier event after a newer one has been applied
--     (e.g. retry of INITIAL_PURCHASE arriving after CANCELLATION).
--   - Re-delivery of an event we already processed (same timestamp).
--
-- Nullable, no default. Pre-existing rows have NULL implicitly — any
-- positive event_timestamp_ms beats NULL on the COALESCE comparison.

begin;

alter table public.trial_entitlements
  add column last_revenuecat_event_at timestamptz;

-- Optional: comment for future readers.
comment on column public.trial_entitlements.last_revenuecat_event_at is
  'Timestamp (event_timestamp_ms from RC) of the last applied RevenueCat webhook event. Used by the Edge Function for idempotency and out-of-order delivery rejection.';

commit;
