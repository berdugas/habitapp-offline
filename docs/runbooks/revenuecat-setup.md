# RevenueCat setup runbook

One-time manual configuration. Run these steps once for sandbox (preview),
once again later for production (handled in sub-plan #6).

## A. RevenueCat dashboard

1. Sign up at https://app.revenuecat.com (free tier is enough — up to
   $2.5k MTR before paid plan).
2. Create a new project: `Habitapp`.
3. Add the Android app:
   - Bundle ID: `com.habitapp.mobile`
   - Get the **public SDK key** from Project Settings → API keys. This is
     the value for `EXPO_PUBLIC_REVENUECAT_API_KEY` (next section).
4. Create a one-time IAP product:
   - Identifier: `lifetime_unlock`
   - Type: Non-consumable / non-renewing
   - Price: $1.99 (mirror what's configured in Play Console — done in
     sub-plan #6's P1 step)
5. Webhook configuration:
   - Project Settings → Integrations → Webhooks
   - URL: `https://<supabase-project-ref>.supabase.co/functions/v1/revenuecat-webhook`
     (replace `<supabase-project-ref>` with the actual ref from Supabase
     project URL — currently `wrytjnucrxsqdrbwxsgi` per memory)
   - Authorization header value: `Bearer <secret>` where `<secret>` is a
     long random string you generate. Save this value — it's also the
     `REVENUECAT_WEBHOOK_SECRET` you set in Supabase next.
6. Add license testers (sandbox emails) for end-to-end test purchases.

## B. EAS environment

```powershell
eas env:create --environment preview `
  --name EXPO_PUBLIC_REVENUECAT_API_KEY `
  --value <public-sdk-key-from-rc-dashboard> `
  --visibility sensitive --scope project
```

## C. Supabase function secret

```powershell
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<bearer-secret-from-step-A5>
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — which the function
also reads via `Deno.env.get()` — are pre-injected on hosted Edge
Functions; you do NOT set those manually. The service-role key bypasses
RLS so the function can update `trial_entitlements`.)

## D. Apply database migrations (REQUIRED before function deploy)

The webhook function depends on two pieces of database state:
- `trial_entitlements.last_revenuecat_event_at` column (migration
  `20260613120000_add_last_revenuecat_event_at.sql`)
- `public.revenuecat_demote(uuid, timestamptz)` RPC (migration
  `20260613130000_revenuecat_demote_rpc.sql`)

Without both migrations applied, every CANCELLATION and TRANSFER
event will fail with a 500 (RPC not found, or missing column).
Apply migrations first:

```powershell
supabase db push
```

This pushes every file in `supabase/migrations/` that isn't already
recorded in the `supabase_migrations.schema_migrations` table. Idempotent
— safe to re-run.

## E. Deploy the function

```powershell
supabase functions deploy revenuecat-webhook
```

After deploy, hit the URL with curl + a fake event to confirm the auth gate:

```powershell
curl -X POST "https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook" `
  -H "Authorization: Bearer wrong-token" `
  -d '{"event":{"type":"TEST","app_user_id":"u1"}}'
```

Expected: 401.

With the correct bearer:

```powershell
curl -X POST "https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook" `
  -H "Authorization: Bearer <real-secret>" `
  -d '{"event":{"type":"TEST","app_user_id":"u1"}}'
```

Expected: 200 (no-op for unknown event type).

## F. Trigger a test event from RC dashboard

RC dashboard → Webhooks → Send test event. Confirm 200 in the dashboard's
delivery log. Tail Supabase function logs in another window:

```powershell
supabase functions logs revenuecat-webhook --tail
```
