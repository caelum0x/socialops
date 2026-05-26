# SocialOps

SocialOps is currently Arhan's local AI video and content operating system.

The near-term goal is not a production SaaS. The goal is to turn internal work
from projects like VCPeer, Recoder, Career Profile, and SocialOps into planned,
AI-generated, ranked, posted, and analyzed content across X, LinkedIn, TikTok,
Reddit, Instagram, YouTube Shorts, and other social platforms.

Core internal loop:

```txt
Capture real work -> research with Pokee -> draft with MiniClaw
  -> rank with x-algorithm -> create visuals/videos with ComfyUI
  -> post through Postiz/OpenPost/manual workflow -> record metrics -> learn
```

This repository is intentionally not a clean-room scheduler or assistant.
Service roles:

- PokeeResearchOSS: search, source reading, citations, research briefs.
- MiniClaw/OpenClaw: AI assistant and content generation.
- ComfyUI: visuals and video assets through `apps/visual-worker`.
- ComfyUI extensions: vetted custom nodes and workflow capabilities.
- Postiz: posting, publishing, scheduling, and account operations where it fits.
- OpenPost: scheduler/account/composer foundation where its integrations fit.
- `x-algorithm`: cloned X/xAI algorithm foundation plus SocialOps adapters.

Main use case:

```txt
Use all connected X accounts, TikTok accounts, LinkedIn accounts, Reddit
accounts, and other social profiles to generate platform-native text/video,
plan distribution, rank candidates, schedule/post through connected services,
track metrics, and feed outcomes back into x-algorithm.
```

Development rule: before writing new code, inspect the cloned foundations and
reuse existing functionality. Do not rebuild the scheduler or assistant from
zero, do not use OpenPost as the entire SocialOps frontend, and do not embed
GPL/AGPL services into the proprietary core app.

This repo can still keep workspaces, approvals, billing, and admin scaffolding,
but those are not the current priority. Internal distribution quality is.

The SocialOps adapter in `x-algorithm/src/ranking.ts` turns local drafts and
metrics into rankable candidates using recommender signals: topic affinity,
recency, engagement quality, specificity, conversation potential, media,
novelty, and downranking for missing facts or muted topics.

Visual generation flow is always:

```txt
ContentDraft -> VisualJob -> visual-worker -> ComfyUI -> VisualAsset
  -> SocialOps media library -> approval -> posting service or manual export
```

The frontend and OpenPost frontend must not call ComfyUI directly.

Video generation uses the SocialOps Video Engine:

```txt
ContentDraft -> VideoScript -> VideoJob -> Remotion/FFmpeg -> VideoAsset
  -> approval -> posting service or manual export
```

ComfyUI can provide thumbnails, backgrounds, and b-roll through
`apps/visual-worker`, but it is not the core video renderer.

Start with:

```bash
pnpm run check:workspace
pnpm run check:types
pnpm run test:api
```

Read the production plan in `PLAN.md`, integration boundaries in
`INTEGRATIONS.md`, and third-party strategy in `VENDOR.md`. Some older docs
still describe the SaaS direction; the current implementation priority is the
internal use-case loop above.

Production deployment starts from
`infra/compose/socialops.production.example.yml`. It keeps posting, MiniClaw,
ComfyUI, and PokeeResearch behind service boundaries.

API development:

```bash
pnpm run migrate:api
pnpm run seed:api
pnpm run dev:api
```

During local development, API routes accept `x-socialops-user-email` and
`x-socialops-user-name` headers. In production, auth headers are required and
workspace membership checks are enforced before source-of-truth writes.

## Terminal Operator Workflow

The fastest local path is the API plus `pnpm ops`; the web app is not required
for the internal content loop.

Start the core services:

```bash
cp .env.example .env
pnpm run migrate:api
pnpm run seed:api
pnpm run dev:api
pnpm run dev:video-worker
```

Core commands:

```bash
pnpm ops status
pnpm ops add-identity --name "Arhan Builder" --platforms x,linkedin,tiktok,reddit --pillars "AI video,building in public,SocialOps"
pnpm ops add-account --platform x --handle "@yourhandle" --publishing-status manual
pnpm ops capture --content "Shipped a SocialOps account and content workflow today" --type work_log --tags socialops,build
pnpm ops generate-posts --platforms x,linkedin,tiktok,reddit --topics "SocialOps,AI video,creator workflow"
pnpm ops rank-x --topics "SocialOps,AI video"
pnpm ops approve-draft --draft-id <draft-id>
pnpm ops publish-package --draft-id <draft-id>
pnpm ops send-openpost --draft-id <draft-id> --openpost-workspace-id <id> --openpost-user-id <id> --openpost-account-ids <id,id>
pnpm ops mark-published --draft-id <draft-id>
pnpm ops add-metrics --draft-id <draft-id> --platform x --impressions 1200 --likes 80 --replies 10
pnpm ops video-from-draft --draft-id <draft-id> --platform tiktok --approve --render
```

Publishing remains approval-first. SocialOps can prepare manual packages and
handoff to OpenPost where a connected account exists, but it does not do browser
bot posting, auto-DMs, fake engagement, or unapproved publishing.
# socialops
