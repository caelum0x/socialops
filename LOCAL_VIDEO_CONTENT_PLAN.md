# SocialOps Local AI Video and Content Plan

SocialOps is Arhan's local AI content engine for turning real work, product builds, research, and ideas into platform-native content for X, LinkedIn, TikTok, Reddit, Instagram, and YouTube Shorts.

The goal is not a clean-room app. The local system connects the cloned foundations already in this repo:

- `PokeeResearchOSS`: source discovery, web reading, citation-backed research briefs, and claim checks.
- `nano-claw` / MiniClaw: assistant control plane for capture, ideation, scripting, rewriting, approvals, and campaign operations.
- `ComfyUI` plus `comfyui-extensions`: internal visual generation for thumbnails, images, b-roll, and optional image-to-video assets.
- `x-algorithm`: local ranking, scoring, candidate selection, and learning from X-style content signals.
- Remotion and FFmpeg: deterministic video assembly, captions, resizing, encoding, stitching, and export.
- `postiz-app`, OpenPost, and manual export: account operations, scheduling, posting where official integrations exist, and manual publish tracking where APIs are limited.

## Local Workflow

```txt
Capture -> Research -> Script -> Rank -> Asset Plan -> Generate Visuals -> Render -> Distribute -> Measure -> Learn
```

1. Capture real inputs: work logs, project updates, screenshots, screen recordings, links, notes, metrics, and rough ideas.
2. Use PokeeResearchOSS for research briefs with source URLs and unsupported-claim flags.
3. Use MiniClaw to create scripts, hooks, threads, captions, product-demo outlines, and platform variants from those facts.
4. Use `x-algorithm` to score candidates by hook strength, novelty, platform fit, media potential, topical freshness, and risk.
5. Use ComfyUI only through SocialOps workers for thumbnails, image assets, b-roll, and approved AI-video workflows.
6. Use Remotion templates plus FFmpeg to render product demos, UGC edits, AI content videos, captioned shorts, and platform crops.
7. Send approved assets to OpenPost/Postiz/manual export, then store metrics back into SocialOps for the next ranking loop.

## Video Pipelines

## Professional Video Bar

The current target is not a slide deck with animated text. SocialOps should aim
for the workflow quality used by tools like Higgsfield, Pippit, Dreamina
Seedance, and serious ComfyUI video workflows:

- product URL or source page intake before the script
- Pokee-backed claim extraction and unsupported-claim warnings
- hook-first creative structures built for TikTok/Reels/Shorts pacing
- real screenshots and screen recordings for product proof
- image-to-video or video-to-video b-roll from ComfyUI Wan/LTXV where local GPU
  generation is available
- optional external adapters for Higgsfield/Pippit/Seedance-class generation
  when the user wants high-end UGC, AI influencer, or trend-native ad formats
- consented avatar/talking-head workflows only, never fake testimonials or
  unapproved likeness/voice cloning
- Remotion/FFmpeg as the final edit, caption, crop, encode, and packaging layer
  instead of pretending Remotion alone is the video generator

Professional output should include shot rhythm, camera motion, visual variation,
sound/voice decisions, caption styling, platform crop variants, and an approval
gate before distribution.

### UGC Videos

UGC uses user-uploaded or consented footage as the primary asset. SocialOps can generate the brief, hook, talking points, captions, b-roll prompts, thumbnails, and platform-specific copy. It must not fake testimonials, impersonate people, or clone voices without consent.

Primary local tools:

- MiniClaw for UGC briefs, hooks, and shot lists.
- ComfyUI for supporting b-roll and thumbnails.
- Whisper or local transcription for captions.
- Piper or another local TTS only when a synthetic voice is intentionally selected.
- Remotion/FFmpeg for assembly and platform exports.
- Optional external provider pass for Higgsfield/Pippit-style trend ads, product
  URL to video, AI avatars, and high-volume creative variations.

### AI Videos

AI videos can use generated visuals, b-roll, text cards, captions, voiceover, and motion templates. They should still start from real facts, research, or project material. SocialOps should label missing facts instead of inventing proof.

Primary local tools:

- PokeeResearchOSS for source material and citations.
- MiniClaw for scene plans and scripts.
- ComfyUI for images, thumbnails, b-roll, and optional image-to-video workflows.
- `x-algorithm` for choosing the best hooks and variants.
- Remotion/FFmpeg for final video composition.
- Optional Seedance/Higgsfield-class provider pass when the target requires
  cinematic motion, consistent characters, or native TikTok trend formats.

### Product Videos

Product videos must use real screenshots or screen recordings for UI. AI can help with thumbnails, overlays, b-roll, captions, narration, and edits, but it must not generate fake product interfaces or fake results.

Primary local tools:

- Real screen recordings and screenshots as required source assets.
- MiniClaw for demo script and step-by-step scene structure.
- ComfyUI for supporting visuals only.
- Remotion/FFmpeg for zooms, captions, cursor callouts, resizing, and final renders.
- Optional Pippit/Higgsfield-style product URL to ad pass for variants, but real
  product capture stays the source of truth.

## Professional Provider Routing

```txt
Research/claims: PokeeResearchOSS
Scripts/hooks/shot plans: MiniClaw
Ranking/variant choice: x-algorithm
Local visual generation: ComfyUI Wan/LTXV/image workflows through visual-worker
External high-end generation: Higgsfield, Pippit, Dreamina Seedance, avatar providers
Final assembly: Remotion + FFmpeg
Publishing handoff: OpenPost/Postiz/manual export
```

Provider rules:

- Use ComfyUI Wan image-to-video for local b-roll, atmospheric inserts, product
  adjacent motion, and generated visual cutaways.
- Use LTXV-style fast workflows for quick concept iteration and motion testing.
- Use Higgsfield-style adapters for viral presets, camera-motion logic,
  product-link-to-ad concepts, and trend recreation with the user's product.
- Use Pippit-style adapters for product UGC suites, avatar voiceovers, quick
  edits, smart crop, and publisher handoff.
- Use Seedance-style adapters for high-motion, native TikTok, consistent
  character/brand scenes.
- Use Remotion only after visual clips exist, to assemble, caption, resize,
  brand, encode, and package.

## API Surface Added

- `GET /v1/content-engine/purpose`: describes the connected local SocialOps engine.
- `GET /v1/content-engine/video-pipelines`: returns default UGC, AI video, and product-demo pipeline plans.
- `POST /v1/workspaces/:workspaceId/content-engine/plan`: builds a workspace-specific multi-platform content plan.
- `POST /v1/workspaces/:workspaceId/content-engine/video-pipeline`: builds a concrete local video pipeline plan for `ugc`, `ai_video`, or `product_demo`.
- `POST /v1/workspaces/:workspaceId/content-drafts/rank-x`: ranks drafts with the local `x-algorithm` package.

## Implementation Milestones

1. Content engine package: keep shared purpose, platform, and local video-pipeline logic in `packages/content-engine`.
2. API planning endpoints: expose the content engine plan and video pipeline plans to the web app and MiniClaw.
3. Visual generation path: route all ComfyUI calls through `apps/visual-worker` and store outputs as SocialOps media assets.
4. Video rendering path: make `apps/video-worker` convert script and scene plans into Remotion/FFmpeg jobs.
5. Posting path: upload approved rendered videos to OpenPost/Postiz where supported and track manual publish elsewhere.
6. Learning loop: import metrics, attach them to drafts/assets/platform variants, and feed the results back into `x-algorithm`.

## Boundaries

- Use official platform APIs, connected services, or manual upload. Do not browser-bot social platforms.
- Do not build spam automation, fake engagement, fake comments, fake testimonials, or scraping-based credential flows.
- Optimize for reach and learning, but do not guarantee virality.
- Keep GPL/AGPL services as separate local services unless the licensing decision changes.
