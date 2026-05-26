# Agent Context

We are building SocialOps.

## Non-Negotiable Build Rule

Before writing new code, inspect the cloned repos and reuse existing
functionality.

Do not rebuild SocialOps from zero. Adapt the cloned foundations for Arhan's
local AI video/content distribution system first.

- Do not create a new posting stack from scratch. Use Postiz/OpenPost as the
  posting, account, scheduler, and composer foundations where they fit.
- Do not make scheduler bridges the default focus. The current priority is the
  internal content loop and `x-algorithm`.
- Do not create a new assistant framework from scratch. Use OpenClaw as
  MiniClaw.
- Do not embed GPL/AGPL services into the proprietary core app. Run them as
  separate services or use them as inspiration only.
- This is not a production SaaS build right now. Keep production scaffolding if
  it already exists, but prioritize Arhan's internal use cases.

Current internal service roles:

- PokeeResearchOSS: search, source discovery, reading, citations, research
  briefs.
- Postiz: posting, publishing, scheduling, and account operations where it fits.
- OpenPost: scheduler/account/composer foundation where its integrations fit.
- OpenClaw/MiniClaw: AI assistant and content generation.
- ComfyUI: visuals and video assets only, through `apps/visual-worker`.
- ComfyUI extensions: vetted custom nodes and workflow capabilities.
- `x-algorithm`: cloned X/xAI algorithm foundation plus SocialOps adapters.

SocialOps adapters under `x-algorithm/src` should connect local drafts,
metrics, and project signals to the cloned algorithm foundation.

App purpose:

```txt
Connect Pokee, MiniClaw, ComfyUI, ComfyUI extensions, x-algorithm, Postiz,
OpenPost, and connected social accounts into one local AI content engine for
LinkedIn, X, TikTok, Reddit, Instagram, YouTube Shorts, and other platforms.
```

SocialOps is not only for founders. It is an AI content workspace for anyone who
needs to build an online presence from their real work, learning, projects,
career, and ideas.

## Core Definition

```txt
SocialOps is an AI workspace that helps people turn their real work, learning,
projects, and career progress into consistent social content.
```

Core promise:

```txt
Turn your work into content.
```

Long-term vision:

```txt
A personal content operating system for the modern career.
```

## Target Users

- students
- interns
- employees
- developers
- designers
- analysts
- job seekers
- career switchers
- founders
- freelancers
- creators
- indie hackers
- agency owners
- consultants

The core user is anyone who needs to post consistently but does not know what
to say, how to package their work, or how to turn daily life into content.

## Content Outputs

SocialOps helps users create:

- LinkedIn posts
- X posts
- X threads
- TikTok/Reels/Shorts scripts
- Instagram carousel copy
- newsletter drafts
- portfolio updates
- project updates
- research briefs
- citation-backed content drafts
- application answers
- outreach messages

## Product Workflow

```txt
Capture -> Organize -> Generate -> Approve -> Publish -> Learn
```

AI drafts. Humans approve.

Do not build scraping, spam automation, auto-DMs, or browser-based auto-posting.

## Product Modes

- Career Mode
- Student Mode
- Internship Mode
- Builder Mode
- Founder Mode
- Freelancer Mode
- Creator Mode
- Job Search Mode
- Project Mode

## Main Routes

```txt
/dashboard
/onboarding
/profile
/career
/projects
/projects/new
/projects/[id]
/capture
/content
/content/new
/content/[id]
/social
/social/accounts
/social/media
/social/scheduler
/calendar
/applications
/applications/[id]
/decks
/decks/[id]
/outreach
/leads
/visuals
/videos
/videos/new
/videos/jobs/[id]
/videos/templates
/videos/assets
/videos/product-demo
/videos/product-demo/new
/videos/product-demo/[id]
/videos/people
/videos/shorts
/approvals
/analytics
/billing
/settings
/admin
/pricing
```

## Production Build Direction

This is not a clean-room MVP. Build a production-oriented product by adapting
the cloned foundations:

- OpenPost is the scheduler/calendar base. Preserve its provider integrations,
  including X, Mastodon, Bluesky, Threads, and LinkedIn, plus workspaces, media
  library, threads, encrypted OAuth tokens, 2FA/passkeys, and scheduler
  behavior.
- OpenClaw is MiniClaw, the assistant/control-plane base. Keep untrusted
  third-party skills disabled by default; only first-party SocialOps skills are
  allowed.
- ComfyUI runs as a separate visual-generation service through a
  SocialOps-owned connector/worker.
- PokeeResearchOSS runs as a separate research service.
- Postiz is AGPL reference or a separate AGPL service only.

License boundaries:

- OpenPost MIT: fork and customize directly.
- OpenClaw MIT: fork and customize directly, with third-party skills disabled
  unless explicitly approved.
- Postiz AGPL-3.0: use as inspiration or run as a separate AGPL service only.
- ComfyUI GPL-3.0: run as a separate internal service and call through APIs;
  do not merge its code into the core app.
- Track third-party licenses in `packages/licensing`.

Frontend architecture:

- Main SocialOps frontend: Next.js App Router, React, TypeScript, TailwindCSS,
  shadcn/ui, TanStack Query, Zod, React Hook Form, Recharts, and Tiptap or
  Lexical.
- OpenPost frontend: embedded/forked scheduler module for `/social`,
  `/calendar`, `/social/accounts`, `/social/media`, and scheduler/composer
  workflows.
- Phase 1: reverse proxy OpenPost under `/social` while preserving its existing
  scheduling behavior.
- Phase 2: add a SocialOps API bridge for scheduling, media, accounts, calendar,
  and status sync.
- Phase 3: only after the product works, port selected OpenPost composer,
  calendar, media picker, account selector, or thread editor components if
  needed.
- OpenClaw/MiniClaw is an assistant service layer surfaced in the SocialOps UI as
  an assistant drawer and command palette, not the main frontend.

Visual generation architecture:

- Do not call ComfyUI directly from the SocialOps frontend or OpenPost frontend.
- SocialOps frontend calls SocialOps APIs such as `/api/visuals/generate`.
- `apps/visual-worker` is the only SocialOps component that talks directly to
  the internal ComfyUI API.
- ComfyUI must stay on an internal network and must not expose port `8188`
  publicly.
- Use allowlisted workflow templates only. Do not allow normal users to upload
  arbitrary ComfyUI workflows, install custom nodes, or execute shell/code via
  prompts.
- Generated files become SocialOps `VisualAsset` records first, then approved
  assets can be attached to `ContentDraft` and uploaded to OpenPost media through
  the SocialOps/OpenPost bridge.

Video engine architecture:

- Do not treat ComfyUI as the whole video engine. ComfyUI is only an internal
  source for thumbnails, generated images, b-roll, and optional image-to-video
  workflows.
- Use a layered pipeline: `ContentDraft -> VideoScript -> ScenePlan ->
  AssetPlan -> VideoJob -> Remotion/FFmpeg render -> VideoAsset -> approval ->
  OpenPost media/scheduler bridge or manual export`.
- Remotion is the controllable template renderer for captioned videos, product
  demos, carousel-to-video, LinkedIn videos, and short-form social videos.
- FFmpeg handles final encoding, trimming, stitching, resizing, and caption
  burn-in. Track FFmpeg build/licensing choices before production distribution.
- Product videos must use real screenshots or screen recordings, not
  AI-generated fake product UI.
- People videos must use user-uploaded video/audio or consent-based avatar
  providers. Do not fake real people, clone voices without consent, impersonate
  public figures, or create fake testimonials.
- External AI video/avatar providers are optional paid adapters only and must be
  gated by plan/credits.
- All rendered videos require human approval before scheduling, publishing,
  export-as-ready, or OpenPost upload.

Production v1 must include:

- personal profile editor
- career profile editor
- project manager
- capture page
- content generator by mode
- LinkedIn generator
- X post/thread generator
- TikTok/Reels script generator
- carousel copy generator
- application answer generator
- outreach draft generator
- approval queue
- content calendar
- manual publish tracker
- basic analytics
- visual prompt generator
- research brief generator
- auth, workspaces, and roles
- billing and entitlements
- admin and audit logs
- background jobs
- backups and observability
- security and license boundaries

Default demo projects:

- VCPeer
- Recoder
- Career Profile
- SocialOps

Use `PLAN.md` as the fuller product spec.
