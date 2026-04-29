-- Core v1 local-first pivot.
--
-- Drops all habit-domain tables (habits, habit_logs, weekly_reviews,
-- habit_context, ai_suggestions), the v_habit_progress_30d view, and
-- the legacy user_profiles table.
-- Recreates account/entitlement-only schema:
--   * public.profiles
--   * public.trial_entitlements
--
-- Habit data moves to on-device SQLite from this point forward.
-- See docs/tech-handoff-core-v1.md sections 1, 3 for context.

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop dependent triggers and policies first (idempotent).
-- ---------------------------------------------------------------------------

drop trigger if exists trg_habits_updated_at on public.habits;
drop trigger if exists trg_habit_context_updated_at on public.habit_context;
drop trigger if exists trg_habit_logs_updated_at on public.habit_logs;
drop trigger if exists trg_weekly_reviews_updated_at on public.weekly_reviews;

-- ---------------------------------------------------------------------------
-- 2. Drop dependent views first, then tables in FK-aware order.
--
-- v_habit_progress_30d was created out-of-band (not in migrations 0001-0004)
-- and reads from habits/habit_logs. Drop explicitly so its removal is
-- intentional rather than a cascade side effect.
--
-- Children of `habits` next, then habits, then user_profiles.
-- ---------------------------------------------------------------------------

drop view if exists public.v_habit_progress_30d cascade;

drop table if exists public.ai_suggestions cascade;
drop table if exists public.habit_logs cascade;
drop table if exists public.weekly_reviews cascade;
drop table if exists public.habit_context cascade;
drop table if exists public.habits cascade;
drop table if exists public.user_profiles cascade;

-- ---------------------------------------------------------------------------
-- 3. Drop custom enum types that only those tables used.
--
-- set_updated_at() is intentionally kept for reuse.
-- ---------------------------------------------------------------------------

drop type if exists public.habit_log_status;
drop type if exists public.difficulty_expectation;
drop type if exists public.common_obstacle;
drop type if exists public.available_time_band;
drop type if exists public.ai_trigger_source;
drop type if exists public.ai_suggestion_category;

-- ---------------------------------------------------------------------------
-- 4. profiles
--
-- Minimal account record. Email mirrors auth.users for convenience and
-- account_status supports the staged deletion flow (Sprint 18).
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  account_status text not null default 'active'
    check (account_status in ('active', 'pending_deletion', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 5. trial_entitlements
--
-- One row per user. trial_started_at + trial_ends_at are the trial window.
-- entitlement_status is what the client checks on validation.
--
-- last_validated_at is informational on the server; the *client* is
-- responsible for tracking its own grace period (see tech handoff 6.4).
-- ---------------------------------------------------------------------------

create table if not exists public.trial_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  entitlement_status text not null default 'trial'
    check (entitlement_status in ('trial', 'active', 'expired', 'paid', 'cancelled')),
  last_validated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers (reuses existing set_updated_at function).
-- ---------------------------------------------------------------------------

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_trial_entitlements_updated_at on public.trial_entitlements;
create trigger trg_trial_entitlements_updated_at
before update on public.trial_entitlements
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row-level security.
--
-- Each user can read and update their own row. Insert is handled by the
-- handle_new_user trigger below (running as SECURITY DEFINER), so we do
-- not grant insert directly to authenticated users.
-- Delete is intentionally not granted from the client; account deletion
-- runs through a server-side flow in Sprint 18.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trial_entitlements enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "trial_entitlements_select_own" on public.trial_entitlements;
create policy "trial_entitlements_select_own"
on public.trial_entitlements for select to authenticated
using (auth.uid() = user_id);

-- Note: trial_entitlements has no client-side update or insert policy.
-- The server (or a future Edge Function) is the only writer once provisioned.

-- ---------------------------------------------------------------------------
-- 8. Auto-provision profile + trial entitlement on user signup.
--
-- Runs as SECURITY DEFINER so it can write to public.profiles and
-- public.trial_entitlements regardless of the inserting user's privileges.
-- search_path is pinned to public + pg_temp to avoid search_path injection.
--
-- Trial window: 14 days from signup, per requirements section 16.1.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.trial_entitlements (user_id, trial_started_at, trial_ends_at)
  values (new.id, timezone('utc', now()), timezone('utc', now()) + interval '14 days');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
