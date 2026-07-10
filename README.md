# Atelier — AI Virtual Try-On Studio

Upload a model, upload a garment, render the look with your choice of fal.ai
try-on model — then set it in motion as a short clip. Every asset, render and
clip lives in a private, per-user library.

**Stack**: Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind 4
· shadcn/ui (restyled) · Supabase (Postgres, Auth, Storage, RLS) · fal.ai ·
Framer Motion · Zod.

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

Sign in with any email — locally, magic links land in Mailpit at
<http://127.0.0.1:54324>. Upload a model photo and a garment photo in
**Library**, combine them in **Studio**, compare providers, then **Animate**
the result. Everything shows up in **History**.

## Hosted Supabase setup

1. Create a project at [database.new](https://database.new).
2. Push the schema: `supabase link --project-ref <ref> && supabase db push`.
3. Auth → URL Configuration: set **Site URL** to your production domain and
   add `https://<your-domain>/**` **and** `http://localhost:3000/**` to
   Redirect URLs. **If you skip this, magic-link emails point at
   `localhost:3000`** — Supabase builds email links from Site URL and
   rejects redirect targets that aren't allow-listed.
4. Auth → Email Templates → Magic Link: use
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   as the link (a styled template is in `supabase/templates/magic_link.html`).
   The `/auth/confirm` route also accepts the default template's PKCE `code`,
   so this step is a nicety, not a requirement.
5. (Optional) Auth → Providers: enable Google for OAuth sign-in.

## Deploying to Vercel

1. Import the repo, framework preset **Next.js**.
2. Set the env vars from `.env.example`, including
   `NEXT_PUBLIC_SITE_URL=https://<your-domain>` so auth emails link to the
   right origin (leave `ENABLE_MOCK_PROVIDER` unset).
3. Image renders run inside a server action with `maxDuration = 150` (set in
   `src/app/studio/page.tsx`) — check your plan allows it; video always uses
   fal's queue with polling, so no long-held requests.

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
