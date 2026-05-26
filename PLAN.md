# SocialOps Product Plan

## Product Definition

SocialOps is an AI workspace that helps people turn their real work, learning,
projects, and career progress into consistent social content.

Core promise:

```txt
Turn your work into content.
```

Long-term vision:

```txt
A personal content operating system for the modern career.
```

SocialOps is not only for founders. It is for anyone who needs to build an online
presence from their actual work, learning, projects, career, and ideas.

## Positioning

Primary positioning:

```txt
SocialOps helps students, professionals, creators, and founders turn their work,
learning, and projects into consistent social content.
```

Alternative positioning:

```txt
  Core Pipeline

  Idea / Work Log / Product Feature
  -> Pokee research + source facts
  -> MiniClaw script/copy generation
  -> x-algorithm ranks hooks, formats, topics
  -> ComfyUI generates visuals, thumbnails, b-roll
  -> Remotion or FFmpeg assembles final videos
  -> Postiz/OpenPost schedules/posts
  -> metrics come back into SocialOps
  -> x-algorithm learns what works

  UGC Videos
  Use real or consent-based assets:

  1. User uploads phone video/audio, screen recording, or product clip.
  2. MiniClaw creates platform-specific UGC scripts:
      - hook
      - scene list
      - captions
      - b-roll prompts
      - CTA
  3. ComfyUI generates supporting visuals:
      - thumbnails
      - backgrounds
      - product b-roll
      - carousel/video frames
  4. Whisper can transcribe local audio.
  5. FFmpeg burns captions, cuts clips, resizes to 9:16, 1:1, 16:9.
  6. Postiz/OpenPost posts or schedules.

  Use open-source pieces:

  - ComfyUI for image/video workflows.
  - Whisper for local transcription.
  - FFmpeg for encoding/cutting/captions.
  - Kdenlive or Blender optional for manual editing.
  - Remotion is useful for template videos, but check license before serious commercial scale.

  AI Product Videos
  For product videos, do not fake UI. Use real screenshots/screen recordings.

  Flow:

  Product screen recording
  -> MiniClaw writes product-demo script
  -> Scene planner splits into intro/problem/demo/proof/CTA
  -> ComfyUI creates thumbnail + supporting b-roll
  -> FFmpeg/Remotion edits screen recording with captions
  -> export per platform

  Examples:

  - LinkedIn: clean product demo with captions.
  - X: short feature clip + thread.
  - TikTok/Reels/Shorts: fast vertical version.
  - Reddit: honest build log, not salesy.

  Open-Source Video Models
  Use them selectively. Local video generation is heavy.

  Good candidates to test:

  - ComfyUI as the workflow host.
  - LTX-Video / ComfyUI-LTXVideo for local image-to-video/video generation.
  - Open-Sora for open-source video generation research, but expect GPU requirements.
  - SadTalker/Wav2Lip-style tools only for consent-based talking-head/lip-sync workflows.

  For now, best quality-to-control path:

  real footage + generated visuals + scripted captions + FFmpeg/Remotion assembly

  rather than fully AI-generated people/videos.

  What We Should Build In SocialOps

  1. UGCBrief
      - product
      - audience
      - platform
      - hook angle
      - clips/assets
      - do-not-say list
  2. VideoScript
      - hook
      - scenes
      - narration
      - captions
      - shot list
      - visual prompts
  3. AssetPlan
      - real screenshots
      - screen recordings
      - ComfyUI thumbnails
      - b-roll prompts
  4. VideoJob
      - render target: TikTok, X, LinkedIn, Reddit, YouTube Shorts
      - aspect ratio
      - caption style
      - output path
  5. DistributionPlan
      - platform variants
      - accounts
      - posting times
      - hashtags/subreddits
      - CTA
      - Postiz/OpenPost handoff
  6. PerformanceLoop
      - views
      - watch time
      - likes
      - comments
      - reposts
      - saves
      - clicks
      - x-algorithm score updates

  Important Constraints
  We can optimize for reach, but not guarantee viral. Also avoid spam automation, fake engagement, fake testimonials, cloned voices without
  consent, or Reddit-style promotional spam.

  Sources checked: ComfyUI GitHub, FFmpeg legal page, Remotion license, OpenAI Whisper GitHub, Open-Sora GitHub, Kdenlive, LTX-Video.
Simple tagline:

```txt
SocialOps - turn your work into content.
```

## Target Users

SocialOps should support:

- students
- interns
- employees
- developers
- designers
- analysts
- founders
- freelancers
- creators
- job seekers
- career switchers
- indie hackers
- researchers
- builders
- agency owners
- consultants

The core user is:

```txt
Anyone who needs to post consistently but does not know what to say, how to
package their work, or how to turn daily life into content.
```

## Jobs To Be Done

Users need to show:

- what they are learning
- what they are building
- what they are working on
- what problems they solve
- what progress they made
- what they believe
- what they can teach
- what they can offer

SocialOps helps them create:

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
- media assets from ComfyUI workflows:
  - images
  - short-video frame/video outputs
  - audio/narration
  - voiceover assets
  - rendered text visuals for quote/caption cards
- application answers
- outreach messages

SocialOps must work for:

- one person building a public career profile
- one company managing its own brand channels
- one agency managing multiple client brands and campaigns

## Product Workflow

```txt
Capture -> Organize -> Generate -> Approve -> Publish -> Learn
```

### Capture

Users add:

- daily notes
- weekly updates
- work updates
- project progress
- internship lessons
- GitHub commits
- screenshots
- documents
- achievements
- ideas
- links
- voice notes
- mistakes
- weekly reflections

### Organize

The system maps inputs to:

- career
- learning
- project
- startup
- job search
- portfolio
- client work
- personal brand

### Generate

The AI creates drafts for:

- LinkedIn
- X
- TikTok
- Instagram
- YouTube Shorts
- newsletter
- portfolio
- email
- DMs
- applications

### Approve

The user edits and approves every output. The product drafts content; it does
not spam or publish without user control.

### Publish

The user posts manually or through allowed integrations.

### Learn

The user tracks:

- views
- likes
- comments
- DMs
- profile visits
- job leads
- customer leads
- replies
- followers

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
- Agency Mode

Each mode should change the generated output, examples, prompts, and suggested
content formats.

## Production V1 Scope

Build SocialOps as a production-oriented product by adapting the cloned
foundations instead of rebuilding from zero.

Before writing new code, inspect the cloned/forked repos and reuse existing
functionality. SocialOps is a unified production system built from proven
foundations, not a clean-room toy scheduler or assistant.

Foundation strategy:

- SocialOps main frontend is our own Next.js/React product shell. OpenPost is
  not the whole frontend.
- OpenPost is the social calendar/scheduler foundation. Fork and modify it
  directly, preserving X, Mastodon, Bluesky, Threads, and LinkedIn integrations,
  workspaces, media library, thread support, encrypted OAuth tokens,
  2FA/passkeys, and scheduling behavior.
- OpenClaw becomes MiniClaw, the SocialOps assistant/control plane. Fork and
  customize it directly, but disable public/untrusted third-party skills by
  default and only allow first-party SocialOps skills.
- Postiz is AGPL-3.0. Use it as inspiration or run it as a separate AGPL service
  only; do not make it the proprietary core app base.
- ComfyUI is GPL-3.0. Run it as a separate internal service and call it through
  `apps/visual-worker`; do not merge ComfyUI code into the core app.
- Remotion powers `apps/video-worker`. Confirm commercial license needs before
  paid team use above its free-license threshold.
- Marp and Slidev power `apps/deck-worker`; Excalidraw can support diagrams and
  carousel-style visuals.
- Umami can run as a separate analytics service.
- Track third-party license decisions in `packages/licensing`.

Target monorepo shape:

```txt
socialops/
  apps/
    web/
    openpost/
    claw/
    visual-worker/
    video-worker/
    deck-worker/
    api/
  packages/
    core/
    db/
    auth/
    billing/
    ai/
    prompts/
    content/
    social/
    approvals/
    crm/
    analytics/
    integrations/
    licensing/
    security/
  services/
    comfyui/
    umami/
    email/
  infra/
    docker/
    compose/
    nginx-or-traefik/
    backups/
    monitoring/
```

Core product features:

1. Personal profile editor
2. Career profile editor
3. Project manager
4. Daily/weekly capture page
5. Content generator by mode
6. LinkedIn post generator
7. X post/thread generator
8. TikTok/Reels script generator
9. Carousel copy generator
10. Application answer generator
11. Outreach draft generator
12. Approval queue
13. Content calendar
14. Manual publish tracker
15. Basic analytics
16. ComfyUI media workflow generator for image, video, audio, voice, and text-visual assets
17. Research brief generator
18. Auth, workspaces, roles, and row-level permission checks
19. Billing, entitlements, and manual payment fallback
20. Admin, audit logs, failed job visibility, and usage controls
21. Background jobs, backups, monitoring, and deployment health checks
22. Company/brand profiles
23. Agency client management
24. Campaign planning
25. UGC brief generation and approval
26. Media asset library for generated/uploaded photos, videos, voice, audio, and documents

## Product Surface

Build the primary product as a web SaaS first.

Desktop is not the primary product right now. A desktop app can come later as a
wrapper or local companion for capture, local rendering, or file watching. The
core system should remain web-first because agencies, companies, and teams need
shared workspaces, approvals, connected accounts, billing, and admin controls.

## Frontend Architecture

Do not use OpenPost as the entire SocialOps frontend. OpenPost is excellent for
social scheduling, platform accounts, media library, thread composition, durable
queued scheduling, and the calendar. SocialOps is larger than scheduling:
profiles, career mode, project mode, capture notes, AI drafts, applications,
decks, visuals, videos, outreach, CRM, analytics, billing, and admin must live
in the main SocialOps product shell.

Main SocialOps frontend:

- Next.js App Router
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query
- Zod
- React Hook Form
- Recharts
- Tiptap or Lexical editor
- MDX/Markdown preview where useful for decks, applications, and scripts

Main app shell:

- sidebar
- top command bar
- workspace switcher
- project switcher
- create button
- AI assistant drawer
- approval queue badge
- usage/billing indicator
- notification center

Main SocialOps-owned pages:

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
- `/analytics`
- `/billing`
- `/settings`
- `/admin`

OpenPost frontend/service owns the scheduler module:

- `/social`
- `/social/accounts`
- `/social/media`
- `/social/scheduler`
- `/calendar`

OpenPost integration phases:

1. Reverse proxy OpenPost under `/social` and keep its auth separate if needed
   temporarily. Do not break existing OpenPost scheduling.
2. Add the SocialOps bridge API: `POST /api/social/schedule`,
   `POST /api/social/media`, `GET /api/social/accounts`,
   `GET /api/social/calendar`, and `GET /api/social/status/:id`.
3. Map SocialOps `Workspace` to OpenPost workspace, `ContentDraft` to OpenPost
   post, `VisualAsset` to OpenPost media, `SocialAccount` to OpenPost provider
   account, and `ContentCalendarItem` to OpenPost scheduled post.
4. Unify auth/session, sync scheduled/published statuses, sync metrics where
   available, hide raw OpenPost branding, and present it as SocialOps Scheduler.
5. Only after the product is working, port selected OpenPost Svelte UI into the
   SocialOps design system or keep it as a microfrontend. Do not do this first.

Never build:

- auto-DMs
- LinkedIn scraping
- auto-posting browser bots
- spam automation
- auto-sending cold email
- fake metrics, fake career history, or fake traction

## AI Service Boundaries

Use PokeeResearchOSS for research:

- source discovery
- web reading
- citation-backed summaries
- claims that need external support

Use MiniClaw/LLM prompts for text:

- LinkedIn/X drafts
- scripts
- carousel copy
- application answers
- outreach drafts

MiniClaw must read from SocialOps source-of-truth records such as
`PersonalProfile`, `CareerProfile`, `Project`, `CaptureNote`,
`ContentPillar`, `ApprovedClaim`, `ForbiddenClaim`, `ToneProfile`,
`ContentHistory`, and `UserGoals`. It must not invent revenue, customers,
degrees, employers, funding, follower counts, awards, testimonials, logos, or
traction. If information is missing, mark the output as missing information and
ask for it instead of fabricating it.

First-party MiniClaw skills:

- capture_note
- generate_linkedin_post
- generate_x_post
- generate_x_thread
- generate_tiktok_script
- generate_carousel_copy
- generate_application_answer
- generate_pitch_deck
- generate_outreach_draft
- generate_visual_prompt
- generate_video_script
- summarize_week
- create_content_calendar
- suggest_replies
- create_follow_up
- update_crm_lead
- approve_draft
- reject_draft

Use ComfyUI only as a separate internal media runtime:

- image generation
- video/frame generation
- audio and voiceover workflows
- rendered text-as-image cards
- thumbnails and visual variants

ComfyUI connection flow:

```txt
SocialOps ContentDraft
  -> visual prompt / workflow template
  -> VisualJob
  -> apps/visual-worker
  -> internal ComfyUI API
  -> generated image/video file
  -> SocialOps VisualAsset
  -> SocialOps media library
  -> OpenPost media/post bridge or manual export
```

Do not call ComfyUI directly from the frontend or from the OpenPost frontend.
The SocialOps frontend calls `/api/visuals/*`; the API creates a `VisualJob`;
the visual worker talks to ComfyUI over the internal network. ComfyUI routes used
by the worker are `/prompt`, `/ws` or `/history/{prompt_id}`, `/view`,
`/upload/image` when needed, and `/queue` for queue inspection.

Visual API routes:

- `POST /api/visuals/generate`
- `GET /api/visuals/jobs/:id`
- `POST /api/visuals/jobs/:id/approve`
- `POST /api/visuals/jobs/:id/reject`
- `POST /api/visuals/assets/:id/attach-to-draft`
- `POST /api/social/openpost/upload-media`
- `POST /api/social/openpost/create-post`
- `POST /api/social/openpost/schedule-post`

ComfyUI worker flow:

1. Load an allowlisted workflow template.
2. Fill prompt, negative prompt, seed, width, and height fields by node id.
3. `POST` the workflow to `COMFYUI_URL + /prompt`.
4. Store the returned `prompt_id` as `VisualJob.comfyPromptId`.
5. Track progress through `/ws` or poll `/history/{prompt_id}`.
6. Fetch generated output through `/view`.
7. Save output to SocialOps storage.
8. Create `VisualAsset`.
9. Let the user approve or reject the asset.
10. On approval, attach it to `ContentDraft` and optionally upload it to
    OpenPost media through the bridge.

First workflow templates:

- `linkedin-career-card`
- `linkedin-carousel-cover`
- `x-founder-post-image`
- `x-thread-cover`
- `tiktok-thumbnail`
- `instagram-carousel-slide`
- `project-update-card`
- `market-map-card`
- `product-demo-thumbnail`

Store workflow template JSON under the visual-worker or visuals package, for
example:

```txt
workflows/linkedin-career-card.json
workflows/linkedin-carousel-cover.json
workflows/x-founder-post-image.json
workflows/x-thread-cover.json
workflows/tiktok-thumbnail.json
workflows/instagram-carousel-slide.json
workflows/project-update-card.json
workflows/market-map-card.json
workflows/product-demo-thumbnail.json
```

Visual generation must fail open for scheduling: if ComfyUI fails, keep the text
draft, show the error, allow retry/manual upload, and do not block a text-only
scheduled post.

Use the media library for:

- uploaded brand photos
- generated images
- generated/editing-ready videos
- voiceover/audio assets
- UGC clips
- product screenshots
- portfolio documents

Use campaigns and UGC briefs for:

- launch campaigns
- client monthly content plans
- creator/UGC assignments
- video/photo deliverables
- platform-specific content packages

Do not merge ComfyUI code into the core app. Clone optional ComfyUI custom nodes
only into the ComfyUI service runtime, track their licenses, and expose them to
SocialOps through first-party workflow keys.

## Video Engine

SocialOps needs a video engine, not only ComfyUI. ComfyUI is useful for
generated thumbnails, image assets, b-roll, stylized visuals, and optional
image-to-video workflows. The controllable production path for most useful
SocialOps videos is scripts, captions, real screenshots/product clips, simple
motion, optional voiceover, and template rendering.

Core video pipeline:

```txt
ContentDraft
  -> VideoScript
  -> scene plan
  -> asset plan
  -> VideoJob
  -> asset generation or capture
  -> Remotion template render
  -> FFmpeg post-processing
  -> VideoAsset
  -> review / approval
  -> ContentDraft attachment
  -> OpenPost media/scheduler bridge or manual export
```

Core stack:

- LLM/MiniClaw for scripts, hooks, scene plans, captions, shot lists, and CTAs.
- Remotion for template-based video rendering.
- FFmpeg for final encoding, trimming, stitching, resizing, caption burn-in, and
  MP4 output. Track FFmpeg build/licensing choices; avoid accidentally relying
  on GPL-only components in proprietary distribution without an explicit license
  decision.
- Playwright for product screenshots, controlled browser captures, and product
  demo scene assets.
- ComfyUI through `apps/visual-worker` for thumbnails, generated scene images,
  b-roll images, and optional image-to-video clips.
- Optional paid provider adapters for high-end AI video or avatars: Runway,
  Luma, Pika/Fal, HeyGen, Creatomate, and manual provider mode.
- OpenPost for approved video media upload, scheduling, and manual export
  handoff.

Video types:

- product demo videos
- TikTok/Reels/Shorts scripts
- auto-rendered short videos
- LinkedIn career videos
- founder update videos
- project update videos
- talking-head/avatar videos
- screen-recording product walkthroughs
- carousel-to-video posts
- AI b-roll videos
- image-to-video clips
- launch videos
- pitch/application videos
- client update videos

Generation levels:

1. Script-only: hook, script, scene list, captions, shot list, CTA, visual
   suggestions.
2. Template-rendered: Remotion creates 9:16, 16:9, 1:1, or 4:5 videos from
   scripts, captions, images, screenshots, brand colors, optional music, and
   optional voiceover.
3. Product demo: Playwright captures real screenshots/screen recordings, then
   Remotion adds zooms, cursor effects, captions, and CTA cards.
4. AI b-roll/image-to-video: ComfyUI or paid external providers generate
   background clips or b-roll, never accurate product UI.
5. People/avatar: user-uploaded media first; consent-based avatar providers only
   for approved users and use cases.

Video API routes:

- `POST /api/videos/script`
- `POST /api/videos/jobs`
- `GET /api/videos/jobs/:id`
- `POST /api/videos/jobs/:id/render`
- `POST /api/videos/jobs/:id/approve`
- `POST /api/videos/jobs/:id/reject`
- `POST /api/videos/assets/:id/attach-to-draft`
- `POST /api/videos/assets/:id/send-to-openpost`
- `POST /api/videos/assets/:id/download`
- `POST /api/videos/product-demo/create`
- `POST /api/videos/product-demo/:id/plan`
- `POST /api/videos/product-demo/:id/capture`
- `POST /api/videos/product-demo/:id/render`
- `POST /api/videos/people/upload`
- `POST /api/videos/people/transcribe`
- `POST /api/videos/people/edit`
- `POST /api/videos/people/render`
- `POST /api/videos/shorts/script`
- `POST /api/videos/shorts/render`
- `POST /api/videos/captions/generate`
- `POST /api/videos/voiceover/generate`
- `POST /api/videos/broll/plan`
- `POST /api/videos/broll/generate`

Video frontend routes:

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

Video worker provider adapters:

```txt
lib/video/providers/remotion.ts
lib/video/providers/comfyui.ts
lib/video/providers/runway.ts
lib/video/providers/luma.ts
lib/video/providers/heygen.ts
lib/video/providers/creatomate.ts
lib/video/providers/manual.ts
```

Build video templates first:

1. Career Lesson Vertical
2. LinkedIn Professional Update
3. Founder Weekly Update
4. Product Demo
5. Project Build Log
6. Carousel-to-Video
7. Pitch Video
8. Launch Video
9. Avatar Explainer
10. Screen Recording Demo

Product demo rules:

- Use real screenshots and screen recordings. Do not hallucinate product UI with
  AI video.
- Use Playwright for screenshots, page recordings, clicking through demo steps,
  and controlled viewport presets.
- Viewports: 1920x1080 landscape, 1080x1350 LinkedIn vertical, 1080x1920
  TikTok/Reels/Shorts, and 1080x1080 square.
- First product demo templates: SaaS Demo, Feature Walkthrough, Founder Launch
  Demo, Before/After Demo, Terminal Demo, Dashboard Demo.

People video rules:

- Mode 1: user uploads raw video, then SocialOps transcribes, suggests cuts,
  generates captions, adds title/b-roll/progress, and renders.
- Mode 2: user uploads or records audio only, then SocialOps creates captions,
  scenes, and visual assets.
- Mode 3: consent-based avatar provider. No fake testimonials, no
  impersonation, no public-figure cloning, no cloned voice without consent.

Caption system:

- Captions are mandatory for rendered social videos.
- Support SRT, VTT, JSON timed captions, and burned-in captions.
- Caption presets: Clean Professional, TikTok Bold, Startup Demo, Career
  Minimal, Dark Mode Tech, White Background LinkedIn.
- Keep captions to 1-2 readable lines with high contrast and safe margins for
  TikTok/Reels UI.

Voiceover modes:

- none
- user uploaded audio
- browser recorded audio
- text-to-speech
- avatar provider voice

OpenPost video handoff:

```txt
VideoAsset approved
  -> upload to OpenPost media library
  -> attach to scheduled post
  -> schedule or manual export
```

For limited or risky platform APIs, SocialOps should produce the final MP4, post
copy, captions, and manual upload instructions instead of automating.

Video safety and cost rules:

- Do not fake people.
- Do not clone voices without consent.
- Do not generate fake customer testimonials.
- Do not impersonate celebrities or public figures.
- Do not use copyrighted logos/characters in generated videos.
- Do not expose ComfyUI publicly.
- Do not allow arbitrary ComfyUI workflow upload from users.
- Do not run expensive external AI video providers on the free tier.
- External AI video providers require paid credits.
- Script-only is cheap; Remotion template renders are the default production
  path; high-end AI video/avatar providers are paid upgrades.

First working video feature:

```txt
Weekly update
  -> TikTok/LinkedIn video script
  -> captions
  -> simple visual scenes
  -> Remotion captioned render
  -> user approval
  -> attach to ContentDraft
  -> OpenPost media upload or manual MP4 export
```

Current hardware assumption:

- development runs on a MacBook
- no NVIDIA/RTX GPU is available
- default media runtime is `macbook_local`
- lightweight image/text-visual workflows are allowed
- heavy Comfy video/audio/voice/custom workflows should be saved as drafts until
  a GPU or cloud runtime is configured

## Routes

```txt
/
/pricing
/features
/use-cases/students
/use-cases/interns
/use-cases/career
/use-cases/founders
/use-cases/freelancers
/use-cases/creators
/login
/register
/legal/privacy
/legal/terms
/legal/refund
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
```

## Data Models

### User

- id
- name
- email
- password_hash or auth_provider
- timezone
- role
- created_at
- updated_at

### Workspace

- id
- owner_user_id
- name
- type: personal | career | startup | agency | creator | team
- plan
- created_at
- updated_at

### WorkspaceMember

- id
- workspace_id
- user_id
- role: owner | admin | editor | viewer
- created_at

### PersonalProfile

- id
- user_id
- name
- headline
- bio
- location
- education_json
- experience_json
- skills_json
- goals_json
- platforms_json
- tone_json
- created_at
- updated_at

### CareerProfile

- id
- user_id
- current_role
- target_roles_json
- internship_status
- industry
- skills_to_show_json
- achievements_json
- portfolio_links_json
- content_pillars_json
- created_at
- updated_at

### Project

- id
- workspace_id
- name
- slug
- type: startup | portfolio | school | work | freelance | content | open_source | career | other
- description
- stage
- website nullable
- links_json
- goals_json
- progress_json
- metrics_json
- content_pillars_json
- approved_claims_json
- forbidden_claims_json
- created_at
- updated_at

### CaptureNote

- id
- workspace_id
- project_id nullable
- user_id
- type: daily_update | weekly_update | lesson | achievement | mistake | idea | link | screenshot | voice_note | work_log
- content
- media_json nullable
- tags_json
- processed_at nullable
- created_at

### ContentDraft

- id
- workspace_id
- project_id nullable
- user_id
- mode: career | student | internship | builder | founder | freelancer | creator | job_search | project | agency
- channel: linkedin | x | tiktok | instagram | youtube_shorts | newsletter | portfolio | email | dm | blog
- type: post | thread | script | carousel | update | reply | outreach | deck | application_answer
- title
- content
- status: idea | draft | needs_review | approved | scheduled | published | manually_published | rejected | failed | archived
- target_audience
- purpose
- scheduled_for nullable
- published_at nullable
- source_note_ids_json
- media_asset_ids_json
- metrics_json
- created_at
- updated_at

Every AI-created draft starts as `draft` or `needs_review`. No generated content
can be scheduled, exported as ready, posted, or sent unless a human approves it.

OpenPost-facing post statuses:

- idea
- draft
- needs_review
- approved
- scheduled
- published
- manually_published
- failed
- archived

Draft provenance fields must identify generated-by-AI, edited-by-user, and
approved-by-user transitions.

### SocialAccount

- id
- workspace_id
- platform
- provider_account_id
- display_name
- oauth_status
- connected_at
- disconnected_at nullable
- created_at
- updated_at

### ContentCalendarItem

- id
- workspace_id
- content_draft_id
- platform
- scheduled_for
- status
- created_at
- updated_at

### ApprovalItem

- id
- workspace_id
- item_type
- item_id
- requested_action
- status: pending | approved | rejected
- reviewer_user_id nullable
- reviewer_note nullable
- created_at
- updated_at

### Application

- id
- user_id
- workspace_id
- project_id nullable
- name
- type: internship | job | accelerator | funding | grant | school | payment_provider | other
- deadline nullable
- url nullable
- status
- created_at
- updated_at

### ApplicationAnswer

- id
- application_id
- question
- answer
- status
- missing_info_json
- created_at
- updated_at

### Lead

- id
- workspace_id
- project_id nullable
- name
- email nullable
- linkedin_url nullable
- x_url nullable
- company nullable
- role nullable
- segment
- source
- status: new | drafted | contacted | replied | interested | paid | not_interested | archived
- notes
- created_at
- updated_at

### OutreachMessage

- id
- workspace_id
- lead_id nullable
- channel: email | linkedin | x | other
- subject nullable
- body
- status: draft | approved | sent | replied | archived
- sent_at nullable
- created_at
- updated_at

### VisualWorkflowTemplate

- id
- key
- name
- channel: linkedin | x | instagram | tiktok | youtube_shorts
- use_case: post_image | carousel_cover | thumbnail | quote_card | metric_card | project_update | market_map | demo_visual
- comfy_workflow_json
- prompt_node_id
- negative_prompt_node_id nullable
- width_node_id nullable
- height_node_id nullable
- seed_node_id nullable
- output_node_id nullable
- created_at
- updated_at

Only admin-created or first-party workflow templates are allowed in production.
Normal users cannot upload arbitrary ComfyUI workflows.

### VisualJob

- id
- user_id
- workspace_id
- content_draft_id nullable
- template_key
- prompt
- status: queued | submitted | running | generated | failed | approved | attached
- comfy_prompt_id nullable
- error nullable
- created_at
- updated_at

### VisualAsset

- id
- user_id
- workspace_id
- visual_job_id
- project_id nullable
- content_draft_id nullable
- file_name
- mime_type
- width nullable
- height nullable
- storage_path
- public_url nullable
- status: generated | approved | rejected | used
- created_at

### SocialPostBridge

- id
- content_draft_id
- visual_asset_ids_json
- openpost_workspace_id nullable
- openpost_media_ids_json nullable
- openpost_post_id nullable
- status: not_sent | media_uploaded | scheduled | published | failed
- created_at
- updated_at

### VideoTemplate

- id
- key
- name
- type: product_demo | tiktok | linkedin | avatar | carousel_video | pitch | update | explainer
- aspect_ratio: 9:16 | 16:9 | 1:1 | 4:5
- duration_target_seconds
- renderer: remotion | creatomate | external
- template_json
- created_at
- updated_at

### VideoScript

- id
- user_id
- workspace_id
- project_id nullable
- content_draft_id nullable
- title
- platform: linkedin | x | tiktok | instagram | youtube_shorts | website
- mode: career | student | founder | creator | project | product_demo
- hook
- script
- scenes_json
- captions_json
- shot_list_json
- voiceover_text
- status: draft | approved | rejected
- created_at
- updated_at

### VideoJob

- id
- user_id
- workspace_id
- project_id nullable
- content_draft_id nullable
- video_script_id nullable
- template_key
- status: queued | planning | generating_assets | rendering | rendered | failed | approved | attached
- render_provider: remotion | comfyui | runway | luma | heygen | creatomate | manual
- aspect_ratio
- duration_seconds nullable
- error nullable
- created_at
- updated_at

### VideoScene

- id
- video_job_id
- order
- scene_type: text | screenshot | screen_recording | ai_image | ai_video | avatar | b_roll | uploaded_media
- narration
- caption
- visual_prompt nullable
- media_asset_id nullable
- duration_seconds
- metadata_json

### VideoAsset

- id
- user_id
- workspace_id
- video_job_id
- file_name
- mime_type
- storage_path
- public_url nullable
- duration_seconds
- width
- height
- status: rendered | approved | rejected | used
- created_at

### VoiceoverAsset

- id
- user_id
- workspace_id
- video_job_id
- provider
- voice_key
- text
- audio_url
- duration_seconds
- transcript_json nullable
- created_at

### CaptionTrack

- id
- video_job_id
- format: srt | vtt | json
- content
- created_at

### CaptionSegment

- id
- video_job_id
- start_ms
- end_ms
- text
- emphasis_words_json
- style_json

### ProductDemoProject

- id
- workspace_id
- project_id nullable
- product_name
- product_url
- goal
- target_audience
- platform
- status
- created_at
- updated_at

### ProductDemoScene

- id
- demo_project_id
- order
- url
- action_description
- narration
- caption
- screenshot_asset_id nullable
- screen_recording_asset_id nullable
- duration_seconds
- zoom_target_json
- created_at

### BrollPlan

- id
- video_job_id
- scene_id
- asset_type: screenshot | ai_image | ai_video | uploaded | diagram | stock_like
- prompt
- status
- asset_id nullable

### VideoPostBridge

- id
- video_asset_id
- content_draft_id
- openpost_media_id nullable
- openpost_post_id nullable
- status: not_uploaded | uploaded | attached | scheduled | failed
- created_at
- updated_at

### Deck

- id
- user_id
- workspace_id
- project_id nullable
- type
- title
- slides_json
- markdown
- renderer: marp | slidev
- status
- export_url nullable
- created_at
- updated_at

### ContentMetric

- id
- workspace_id
- content_draft_id
- platform
- impressions nullable
- likes nullable
- comments nullable
- shares nullable
- clicks nullable
- replies nullable
- profile_visits nullable
- leads nullable
- entered_manually boolean
- created_at

### AuditLog

- id
- workspace_id
- user_id nullable
- actor_type
- action
- target_type
- target_id
- metadata_json
- created_at

### ResearchBrief

- id
- user_id
- project_id nullable
- source_note_id nullable
- topic
- question
- summary
- citations_json
- status: draft | needs_review | approved | archived
- created_at
- updated_at

## Default Example Projects

The production seed/demo user should include:

- VCPeer
- Recoder
- Career Profile
- SocialOps

## Weekly Prompt

Every Sunday or Monday, ask:

- What did you work on this week?
- What did you learn?
- What was hard?
- What changed?
- What are you proud of?
- What mistake did you make?
- What are you building?
- What do you want people to know about you?
- What opportunities are you looking for?

Then generate:

- 5 LinkedIn posts
- 5 X posts
- 3 TikTok scripts
- 1 weekly recap
- 1 portfolio update
- 1 outreach message

## Pricing

### Free

- 1 profile
- 1 project
- 20 drafts/month
- copy/export

### Student

- $5-9/month
- 3 projects
- 100 drafts/month
- career mode
- LinkedIn posts
- project posts
- TikTok scripts

### Pro

- $19/month
- unlimited projects
- 500 drafts/month
- LinkedIn + X + TikTok
- calendar
- application answers
- visual prompts
- analytics

### Founder/Freelancer

- $49/month
- startup profiles
- pitch deck drafts
- outreach drafts
- client posts
- application forms
- CRM

### Studio

- $99/month
- multiple workspaces
- team roles
- client/project organization
- higher limits

Payment provider is abstracted with:

```txt
PAYMENT_PROVIDER=paddle | dodo | creem | polar | iyzico | paytr | manual
```

Manual fallback:

- user requests plan
- admin marks paid
- entitlement is granted

Usage limits:

- ai_drafts_per_month
- visual_generations_per_month
- video_renders_per_month
- deck_exports_per_month
- scheduled_posts_per_month
- connected_accounts

Visual generation limits:

- Free: 3/month
- Student: 20/month
- Pro: 100/month
- Founder/Freelancer: 300/month
- Studio: 1000/month

Video limits:

- Free: 3 video scripts/month, 0 rendered videos
- Student: 20 scripts/month, 3 rendered videos/month, no external AI video
- Pro: 100 scripts/month, 20 rendered videos/month
- Founder/Freelancer: 300 scripts/month, 50 rendered videos/month
- Studio: 1000 scripts/month, 200 rendered videos/month
- Runway, Luma, HeyGen, Pika/Fal, and similar external video providers require
  paid credits

### Setup Service

- $49 beta setup for students and early users
- $99-199 setup for founders, freelancers, and agencies

Setup includes:

- profile direction
- 5 content pillars
- 30 post ideas
- 10 ready-to-post drafts
- weekly posting calendar

## Production Build Order

1. Create/normalize the monorepo and cloned foundations.
2. Inspect OpenPost and preserve existing social scheduling.
3. Inspect OpenClaw and disable untrusted/public skills.
4. Build the main SocialOps Next.js app shell.
5. Build SocialOps core DB models.
6. Build auth, workspaces, roles, and row-level permission checks.
7. Build onboarding.
8. Build profile, project, and capture systems.
9. Reverse proxy OpenPost into `/social` and `/calendar`.
10. Add the SocialOps-to-OpenPost bridge API.
11. Add `ContentDraft`, approval statuses, manual publish states, platform
   variants, and provenance to the OpenPost workflow.
12. Integrate MiniClaw/OpenClaw for AI generation.
13. Build content generation templates by mode.
14. Build the approval queue.
15. Build manual publish/copy tracker.
16. Add `VisualWorkflowTemplate`, `VisualJob`, `VisualAsset`, and
   `SocialPostBridge` tables.
17. Add the first static ComfyUI workflow template.
18. Build visual-worker `/generate`, `/history` polling, `/view` fetch, and
   local/object-storage save.
19. Show generated visual preview in SocialOps.
20. Add approve/reject and attach-to-draft flows.
21. Upload approved assets to OpenPost media and schedule through the bridge.
22. Build deck-worker with Marp/Slidev.
23. Build VideoScript generation for TikTok/LinkedIn/product demo scripts.
24. Add VideoTemplate registry.
25. Build Remotion template renderer and FFmpeg final encoding.
26. Add VideoJob queue/status and video preview page.
27. Attach approved VideoAsset to ContentDraft and OpenPost media.
28. Add ComfyUI thumbnail/background/b-roll support through visual-worker.
29. Add product screenshot/demo capture with Playwright.
30. Add user-upload people video captions/edit flow.
31. Add consent-based avatar and external AI video provider adapters later.
32. Build CRM and outreach drafts.
33. Build billing, entitlements, usage limits, and manual payment fallback.
34. Build analytics for manual and connected account metrics.
35. Build admin.
36. Add security hardening.
37. Add backups, monitoring, logs, health checks, and deployment docs.
38. Deploy production.

## Production Systems

Authentication:

- email/password or OAuth
- password reset
- email verification
- secure sessions
- optional 2FA later

Authorization:

- workspace owner/admin/editor/viewer roles
- row-level permission checks
- no cross-workspace data leaks

Background jobs:

- AI generation
- visual generation
- video rendering
- scheduled publishing where officially supported
- metric sync where supported
- email notifications
- cleanup jobs

Observability:

- server logs
- job logs
- failed generation logs
- failed publishing logs
- webhook logs
- payment logs
- error dashboard

Security:

- encrypt OAuth tokens
- encrypt provider secrets
- CSRF protection
- rate limiting
- audit logs
- backup secrets separately
- do not expose OpenPost, MiniClaw, ComfyUI, or research admin ports publicly
- run internal services behind reverse proxy and HTTPS
- disable untrusted OpenClaw skills
- do not allow arbitrary shell commands from user prompts

Deployment:

- Docker Compose first
- reverse proxy with HTTPS
- Postgres for the main app
- SQLite allowed only for OpenPost if preserving original behavior, with a
  bridge/migration plan
- object storage for media
- Redis or another queue service if needed
- ComfyUI on a separate internal port
- MiniClaw on a separate internal service
- backups for database and media
- health checks and cron jobs

## Admin

Admin routes:

```txt
/admin/users
/admin/workspaces
/admin/billing
/admin/usage
/admin/generations
/admin/errors
/admin/reports
/admin/manual-payments
```

Admin actions:

- grant plan
- revoke plan
- reset usage
- view failed jobs
- view failed payments
- disable unsafe user
- inspect abuse reports
- export user/workspace data on request

## Acceptance Criteria

Production v1 is successful when:

1. SocialOps main UI runs as a Next.js app shell.
2. OpenPost runs as the `/social` scheduler module, not the whole frontend.
3. User can register and create a workspace.
4. User can complete onboarding.
5. User can create personal and career profiles.
6. User can create multiple projects.
7. User can capture daily/weekly notes.
8. MiniClaw assistant drawer works with first-party skills only.
9. MiniClaw generates content from real source-of-truth.
10. User can generate LinkedIn, X, TikTok, and carousel drafts.
11. Drafts enter the approval queue.
12. User can approve, edit, or reject drafts.
13. Approved drafts can be pushed to OpenPost or copied manually.
14. Calendar shows SocialOps drafts and OpenPost scheduled posts together.
15. User can generate visuals through the ComfyUI service.
16. User can generate decks through Marp/Slidev.
17. User can generate a TikTok/LinkedIn video script.
18. User can render a simple vertical captioned video through Remotion/FFmpeg.
19. User can create a product demo video from real screenshots/screen recording.
20. User can upload a people video/audio file and generate captions.
21. User can insert approved ComfyUI visual assets into a video.
22. User can approve/reject the final video.
23. Approved video can be sent to OpenPost media/scheduler or exported manually.
24. Free tier cannot burn expensive external AI video credits.
25. User can track metrics manually.
26. Billing/entitlements work or manual payment fallback works.
27. Admin can manage users, plans, failed jobs, and usage.
28. OAuth tokens and secrets are encrypted.
29. Background jobs, logs, and backups exist.
30. Nothing is auto-posted or auto-sent without approval.

## Product Guardrails

- AI drafts; humans approve.
- No scraping.
- No spam automation.
- No auto-DMs.
- No browser-based auto-posting.
- Avoid confidential company details.
- Help users turn real work into credible proof, not fake authority.
