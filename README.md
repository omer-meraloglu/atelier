# Atelier — AI Virtual Try-On Studio

Upload a model, upload a garment, render the look with your choice of fal.ai
try-on model — then set it in motion as a short clip. Every asset, render and
clip lives in a private, per-user library. Subscriptions grant monthly
credits; renders spend them (still = 1, clip = 20).

**Stack**: Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind 4
· shadcn/ui (restyled) · Supabase (Postgres, Auth, Storage, RLS) · fal.ai ·
Paddle (billing) · Framer Motion · Zod.

**Auth**: email + password (with confirmation), magic link, and Google OAuth
— all three live side by side on `/login`; password reset via
`/auth/update-password`.

## Quick start

Prereqs: Node 22+ (20 works, but supabase-js deprecates it), pnpm, Docker
(for the local Supabase stack), the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone <this repo> && cd atelier
pnpm install

# 1. Start the local Supabase stack (Postgres, Auth, Storage, mail catcher)
supabase start          # prints local URL + keys
supabase db reset       # applies migrations in supabase/migrations

# 2. Environment
cp .env.example .env.local
#    - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY:
#      from `supabase status` (local) or your hosted project's API settings
#    - SUPABASE_SERVICE_ROLE_KEY: same place (server-only)
#    - FAL_KEY: from https://fal.ai/dashboard/keys (server-only)
#    - ENABLE_MOCK_PROVIDER=1 to try the full flow without a FAL_KEY

# 3. Run
pnpm dev                # http://localhost:3000
```

Sign in with any email — locally, all auth emails (confirmation, magic link,
reset) land in Mailpit at <http://127.0.0.1:54324>. Upload a model photo and
a garment photo in **Library**, combine them in **Studio**, compare
providers, then **Animate** the result. Everything shows up in **History**;
plan, credits and the ledger live under **/account**.

With `ENABLE_MOCK_PROVIDER=1`, billing is mocked too: `/pricing` →
"checkout" is a local confirmation page that grants the plan/credits through
the exact same fulfillment path as the real webhook.

## Billing setup (Paddle)

Paddle is the default real provider (Merchant of Record — works for
Turkey-based sellers and handles global VAT/sales tax). To wire the sandbox:

1. Create a sandbox account at
   [sandbox-vendors.paddle.com](https://sandbox-vendors.paddle.com), grab an
   API key → `PADDLE_API_KEY`, and set `PADDLE_ENV=` (empty = sandbox).
2. Create two subscription products (Starter $9/mo, Studio $29/mo) and two
   one-time products (100 credits $6, 500 credits $25); put their price ids
   in `PADDLE_PRICE_STARTER`, `PADDLE_PRICE_STUDIO`, `PADDLE_PRICE_PACK_100`,
   `PADDLE_PRICE_PACK_500`.
3. Configure a default payment link domain (Checkout → checkout settings) so
   transactions return hosted checkout URLs.
4. Add a webhook destination pointing at
   `https://<your-domain>/api/billing/webhook`, subscribe to
   `subscription.activated`, `subscription.canceled`,
   `transaction.completed`, and put the endpoint's secret in
   `PADDLE_WEBHOOK_SECRET`.
5. Set `BILLING_PROVIDER=paddle` in production.

Tiers, pack sizes and credit costs are all in `src/lib/billing/plans.ts`.

## Hosted Supabase setup

1. Create a project at [database.new](https://database.new).
2. Push the schema: `supabase link --project-ref <ref> && supabase db push`.
3. Auth → URL Configuration: set **Site URL** to your production domain and
   add `https://<your-domain>/**` **and** `http://localhost:3000/**` to
   Redirect URLs. **If you skip this, magic-link emails point at
   `localhost:3000`** — Supabase builds email links from Site URL and
   rejects redirect targets that aren't allow-listed.
4. Auth → Email Templates: styled templates live in `supabase/templates/`
   (`magic_link.html`, `confirmation.html`, `recovery.html`). Link formats:
   - Magic link / Confirm signup:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - Reset password:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`
   The `/auth/confirm` route also accepts the default templates' PKCE `code`,
   so this step is a nicety, not a requirement.
5. Auth → Providers: keep Email enabled (password + magic link);
   optionally enable Google for OAuth sign-in.

## Deploying to Vercel

1. Import the repo, framework preset **Next.js**.
2. Set the env vars from `.env.example`, including
   `NEXT_PUBLIC_SITE_URL=https://<your-domain>` — it drives auth email
   links AND the fal webhook callback (leave `ENABLE_MOCK_PROVIDER` unset).
3. Image renders run inside a server action with `maxDuration = 150` (set in
   `src/app/studio/page.tsx`) — check your plan allows it. Video clips are
   finalized by fal's webhook (`/api/fal/webhook`) with client polling as a
   fallback, so nothing depends on a browser staying open.

## Architecture notes

- **Provider adapters**: `src/lib/providers/tryon.ts` and
  `src/lib/providers/video.ts` each export a registry array; adding a fal
  model is one entry implementing `buildInput`/`parseOutput`. The Studio and
  Animate selectors render straight from these registries, and every render
  logs `provider_model_id`, `latency_ms` and raw params for honest A/B
  comparison.
- **Security**: `FAL_KEY` and the service-role key never leave the server.
  All three tables enforce RLS (`user_id = auth.uid()`); the `assets` bucket
  is private with per-folder policies, and media is served via short-lived
  signed URLs. Inputs are validated with Zod at every server boundary.
  Uploads are capped at 10 MB (JPG/PNG/WebP); the bucket caps objects at
  50 MB for clips.
- **Lifecycle honesty**: generation rows always end `succeeded` or `failed`
  with the error recorded; video jobs stuck >15 min are failed by the poller.
- See `DECISIONS.md` for the running log of assumptions and trade-offs, and
  `DESIGN.md` for the visual system (`/style` shows it live).
