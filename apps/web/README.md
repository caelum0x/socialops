# SocialOps Web App

Main SaaS product shell.

This is the primary SocialOps frontend. Use Next.js App Router, React,
TypeScript, TailwindCSS, shadcn/ui, TanStack Query, Zod, React Hook Form,
Recharts, and Tiptap or Lexical for product UI.

Own these routes in this app:

- `/dashboard`
- `/onboarding`
- `/profile`
- `/career`
- `/projects`
- `/capture`
- `/content`
- `/approvals`
- `/applications`
- `/decks`
- `/outreach`
- `/leads`
- `/visuals`
- `/videos`
- `/videos/new`
- `/videos/jobs/[id]`
- `/videos/templates`
- `/videos/assets`
- `/videos/product-demo`
- `/videos/product-demo/new`
- `/videos/product-demo/[id]`
- `/videos/people`
- `/videos/shorts`
- `/analytics`
- `/billing`
- `/settings`
- `/admin`

Wrap rather than replace the adapted foundations:

- `/social`, `/social/accounts`, `/social/media`, `/social/scheduler`, and
  `/calendar` use OpenPost scheduling capability.
- AI generation uses MiniClaw.
- Visual generation calls SocialOps `/api/visuals/*` routes, which create
  `VisualJob` records for `apps/visual-worker`; the frontend never calls
  ComfyUI directly.
- Research briefs use the PokeeResearch service.
- Decks use worker apps.
- Video generation calls SocialOps `/api/videos/*` routes, which create
  `VideoScript`, `VideoJob`, and `VideoAsset` records for `apps/video-worker`;
  the frontend does not call Remotion, FFmpeg, ComfyUI, or external AI video
  providers directly.

Do not use OpenPost as the entire frontend. Start with a reverse proxy for the
OpenPost scheduler module, then add an API bridge, and only port selected
OpenPost Svelte components later if revenue and product needs justify it.
