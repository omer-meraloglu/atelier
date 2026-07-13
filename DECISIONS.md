# Decisions & Assumptions

A running log, newest last.

## Stack & scaffold

- **Next.js 16 (App Router, Turbopack) + TypeScript strict.** The Next 16
  conventions differ from 15: `proxy.ts` replaces `middleware.ts`, request APIs
  (`cookies`, `params`, `searchParams`) are async-only, ESLint is flat config.
- **TypeScript pinned to 5.x** (6.0 is out but the ecosystem — Next plugin,
  eslint — still targets 5.x). **ESLint pinned to 9.x** for
  `eslint-plugin-react` compatibility.
- **Node 22+ recommended** — supabase-js 2.110 wants native `WebSocket`
  (Node 20 works for the app itself, but is deprecated by supabase-js).

## Design

- **Light-only editorial theme.** Bone `#f2efe9` ground, ink `#191712` text,
  a single oxblood `#6e2f28` accent. No dark mode in the MVP: one look, done
  properly, beats two half-tuned ones.
- **Fraunces** (display serif, only headlines) + **Instrument Sans** (all UI).
- **Sharp corners (2px), hairline borders, film-grain wash.** shadcn
  primitives restyled at token level; button/badge are uppercase tracked
  micro-labels.
- Motion: `cubic-bezier(0.22, 1, 0.36, 1)`, 200/450/900ms tiers, no bounce.

## Auth & data

- **Supabase Auth with magic link + Google OAuth.** Magic-link lands on
  `/auth/confirm`, which accepts both `token_hash` (custom email template —
  shipped in `supabase/templates/`) and `code` (default PKCE template), so the
  flow works with or without template configuration.
- **RLS on all three tables** (assets, generations, video_generations), four
  policies each, plus owner-scoped storage policies on the private `assets`
  bucket (`{user_id}/...` prefix). Verified with a two-user isolation test:
  spoofed inserts, cross-reads, cross-updates and cross-folder storage access
  are all rejected.
- **`video_generations` enforces exactly-one-source** (asset XOR generation)
  with a check constraint rather than app logic.
- **Uploads go browser → storage directly** (storage RLS scopes the path),
  then a server action validates and records the row. Keeps bytes off the
  Next server and gives the UI an optimistic thumbnail.
- **Deleting an asset cascades its generations rows.** Their result files are
  left as orphans in the private bucket — invisible and cheap; a cleanup job
  is out of MVP scope.
- Local dev uses `supabase start` (Docker); `.env.local` carries the local
  demo keys and is git-ignored.

## Providers

- Endpoint IDs and schemas verified against fal.ai docs (July 2026), not
  memory:
  - Try-on: `fal-ai/fashn/tryon/v1.6`, `fal-ai/idm-vton`,
    `fal-ai/kling/v1-5/kolors-virtual-try-on`.
  - Video: `fal-ai/kling-video/v2.1/standard/image-to-video`,
    `fal-ai/minimax/hailuo-02/standard/image-to-video`.
- IDM-VTON requires a garment `description`; we pass the product label with a
  generic fallback.
- The brief's `full` category maps to FASHN's `one-pieces`; other providers
  ignore category.
- Neither wired video model exposes a true aspect-ratio or motion-strength
  parameter; motion level is mapped into the prompt text and the panel only
  shows controls a provider actually supports.

## Generation pipelines

- **Images render synchronously** inside a server action (the brief's flow):
  row → `processing` → fal `subscribe` → result stored → terminal state. The
  Studio page exports `maxDuration = 150` so Vercel keeps the action alive;
  if a target plan caps below that, the image path should move to the same
  queue+poll pattern video uses.
- **Video renders via fal's queue**: `queue.submit` on start (requestId kept
  in `params`), then the Animate panel polls a server action every 6s. The
  poll tick downloads and stores the mp4 on completion, promotes
  `queued → processing` honestly, and abandons jobs stuck past 15 minutes.
  No HTTP request is ever held open for a render.
- **Poster frames are captured in the browser** (canvas grab of frame one
  after playback starts) and uploaded to the user's folder — serverless-safe,
  no ffmpeg dependency. Clips without a poster fall back to their source
  still in the grids.
- **Rate guards**: 6 try-ons/minute; at most 2 video jobs in flight. Guards
  live in the actions, backed by row counts — deliberate MVP simplicity.
- **Mock providers** (`ENABLE_MOCK_PROVIDER=1`) let the entire lifecycle run
  without spending fal credits: try-on echoes the model image after 3s; video
  serves `dev/mock-clip.mp4` after 8s through the real queue/poll machinery.
- **"Save to library" copies the render** into a new storage object and
  registers it as a *model* asset — so a finished look can be layered with
  the next garment. Copy (not reference) keeps deletes independent.

## V2 — bug fixes

- **Video completion is server-driven now.** Root cause confirmed by repro:
  the only finalizer was the Animate panel's poll loop, so closing the Sheet
  or navigating orphaned jobs (a clip sat `queued` forever). Fixes, layered:
  (1) `fal.queue.submit` gets a `webhookUrl` (`/api/fal/webhook`, ED25519
  verification against fal's JWKS per their spec) whenever
  `NEXT_PUBLIC_SITE_URL` is https — fal finalizes clips with zero clients
  attached; (2) a `VideoJobsWatcher` mounted in the site nav is the single
  client-side poller across all pages (panel just listens to its broadcasts),
  covering local dev and the mock provider; (3) shared tick/finalize logic in
  `src/lib/video-jobs.ts` used by action, watcher and webhook alike.
  Verified: clip started, panel closed + navigated away in <1s → completed at
  34s with toast; a stranded pre-fix job recovered on next page load.
- **Library tabs are client-state.** One query fetches both kinds; the
  Models/Products toggle filters locally and syncs `?kind=` via
  `history.replaceState` — no server round-trip, deep links intact.
- **Signed URLs are cached server-side** (`src/lib/signed-urls.ts`,
  `unstable_cache`, 45-min TTL under the 60-min signature). Re-signing per
  request had made every image URL unique per page view, defeating both the
  browser cache and the next/image optimizer. Trade-offs: signing uses the
  admin client (cache can't touch cookies) but only for paths already
  RLS-fetched by the caller; a URL served near the cache window's end still
  has ≥15 min of signature left. Optimizer caching shows only in production
  (dev always serves `max-age=0`) — verified URL identity across visits in
  dev instead. Provider-bound URLs stay short-lived and uncached.
- **Page transition trimmed to a 200ms opacity fade** — the 450ms
  slide-and-fade read as lag on every navigation.
- **`turbopack.root` pinned** — a stray `~/package-lock.json` made Turbopack
  infer the wrong workspace root. Also: a corrupted `.next` dev cache caused
  silent non-hydration ("Cannot find module 'sonner'" in SSR chunks);
  `rm -rf .next && pnpm install` clears it.

## V2 — auth

- **Password auth added alongside magic link and Google**, not replacing
  them. One sign-in form dispatches three intents (password / magic link /
  reset) so the typed email serves all three buttons.
- Signup requires email confirmation (enabled locally too, matching prod);
  the confirmation and recovery emails ship as styled templates. The
  recovery link chains `/auth/confirm?type=recovery&next=/auth/update-password`
  → recovery session → new-password form.
- Password resets answer identically whether or not the account exists
  (anti-enumeration); signups against an existing email surface a friendly
  "sign in instead" (Supabase's empty-identities quirk handled).

## V2 — billing

- **Paddle as the real provider** (Merchant of Record; Stripe doesn't
  onboard Turkey-based merchants, PayPal doesn't operate there). Built
  behind a `BillingProvider` adapter (`src/lib/billing/provider.ts`)
  mirroring the fal registry pattern; iyzico/PayTR for TRY-local sales is a
  future adapter, not a blocker. Prices in USD; the MoR handles VAT/KDV.
- **Mock billing provider** (`ENABLE_MOCK_PROVIDER=1`): checkout is a local
  confirm page whose completion applies the *same* normalized events as the
  webhook (`applyBillingEvent`), so subscribe → grant → spend → refund runs
  offline.
- **Credits: append-only ledger, balance = sum(delta).** Spending happens in
  a `security definer` Postgres function (`spend_credits`) that advisory-locks
  the user, checks the balance and inserts the debit atomically; it reads
  `auth.uid()` so a caller can only spend their own credits. Grants/refunds
  are service-role-only.
- **Idempotency by constraint, not by care**: `billing_events` PK absorbs
  webhook replays; partial unique indexes make the signup grant
  once-per-user and refunds/grants once-per-reference — the watcher, webhook
  and a poll tick can all fail the same clip and compensation still lands
  exactly once.
- **Pricing** (tunable in `src/lib/billing/plans.ts`): Free = 10 signup
  credits, stills only. Starter $9 → 200/mo + video. Studio $29 → 1,000/mo.
  Packs: 100/$6, 500/$25. Costs: still = 1, clip = 20 (≈ fal's image:video
  cost ratio). Renewal grants ride `transaction.completed`
  (`origin=subscription_recurring`); canceling stops grants but banked
  credits remain.
- Spend happens **before** the fal submit; every failure path refunds via
  `refundSpentCredits` (looks up the actual debit, compensates once).
  The video plan-gate and all metering live in the server actions — the UI
  CTAs are a courtesy, not the enforcement.
