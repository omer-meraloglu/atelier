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
