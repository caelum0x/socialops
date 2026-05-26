# SocialOps Architecture

Status: planning doc (companion to `docs/TODO.md`). Source of truth: `PLAN.md`, `PLAN1.md`, `VENDOR.md`.
Snapshot: 2026-05-26.

---

## 1. Product Positioning

SocialOps is a **content + posting operating system for one person who runs many accounts**.
Primary operator: the codebase author — LinkedIn + multiple Twitter/X handles + TikTok + Instagram + YouTube Shorts + Reddit.
Goal: build brand, post viral content, demo products, grow followers, capture leads — without spam, without scraping, without fake testimonials.

Three hard rails:

1. **Approval-first**: nothing posts/sends without a human click. Every generator writes `status = needs_review`.
2. **License isolation**: GPL/AGPL code (ComfyUI, Postiz, Plunk, listmonk, Twenty, Formbricks) runs as a separate service. Never imported into the proprietary core.
3. **FTC compliance**: AI UGC is **scripted spokesperson content**, never fake customer testimony. The system labels generated content and refuses to render fake testimonials.

---

## 2. Layered Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ User surface                                                  │
│   - apps/web              (operator UI, today: Vite + vanilla)│
│   - tools/socialops.mjs   (operator CLI: `pnpm ops`)          │
└──────────────────────────┬────────────────────────────────────┘
                           │  HTTP (dev-headers in dev, sessions in prod)
┌──────────────────────────▼────────────────────────────────────┐
│ API (apps/api, Fastify)                                       │
│   - workspaces / RBAC / entitlements                          │
│   - content drafts / generation / approvals                   │
│   - visuals / videos / decks (job orchestration)              │
│   - leads / outreach / applications / research                │
│   - calendar / metrics                                        │
└──────┬──────────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   visual-    video-     deck-      claw       openpost
   worker     worker     worker     (MiniClaw) (scheduler)
       │          │                    │          │
       │          │                    │          │
       ▼          ▼                    ▼          ▼
   ┌─────────┐ ┌─────────┐         ┌──────┐  ┌──────────┐
   │ ComfyUI │ │ Remotion│         │ LLM  │  │ X/LinkedIn│
   │ (GPL)   │ │ + FFmpeg│         │ APIs │  │ Mastodon │
   │ as svc  │ │ Playwght│         └──────┘  │ Bluesky  │
   └────┬────┘ │ Whisper │                   │ Threads  │
        │      │ rembg   │                   └──────────┘
        │      │ OpenVc  │
        ▼      └─────────┘
   custom nodes
   (allowlisted)

PokeeResearch → research_briefs (Apache-2.0, separate service)
x-algorithm  → ranking adapter (proprietary, in-monorepo)
```

The **API never reaches ComfyUI / Remotion / MiniClaw directly from a route handler**. Every external job goes via a worker app, which holds the provider credentials and enforces workflow allowlists.

---

## 3. Component Map

### Apps

| Directory | Role | Language | Owner |
| --- | --- | --- | --- |
| `apps/api` | Fastify API, RBAC, job orchestration | TS | core team |
| `apps/web` | Operator UI shell | TS (Vite today; Next.js later — see §11) | core |
| `apps/visual-worker` | ComfyUI gateway: workflow allowlist, prompt fill, poll, save | TS | core |
| `apps/video-worker` | Remotion bundler + FFmpeg post-processor; Playwright capture (planned) | TS | core |
| `apps/deck-worker` | Marp + Slidev renderer (PDF/HTML) | TS | core |
| `apps/claw` | OpenClaw MIT fork → MiniClaw, first-party skills only | TS | fork-track |
| `apps/openpost` | OpenPost MIT fork: scheduler + 5 native posting integrations | Go + Svelte | fork-track |

### Packages

| Package | Role |
| --- | --- |
| `packages/core` | TS model types, shared enums (modes, channels, statuses, aspect ratios) |
| `packages/db` | SQL migrations + schema type map; one consolidated `0001_socialops_core.sql` |
| `packages/approvals` | Allowed status transitions (`canTransitionContent`) |
| `packages/content` | Content policy (manual-publish guards) |
| `packages/content-engine` | Purpose, video pipelines, video providers — shared planning logic |
| `packages/prompts` | LLM templates per skill |
| ⬜ `packages/billing` | Plan entitlements (referenced in routes.ts — needs verification on disk) |
| ⬜ `packages/integrations` | ComfyUI client, Pokee client, comfy-presets, comfy-extensions |
| ⬜ `packages/security` | Token encryption helpers (planned) |
| ⬜ `packages/licensing` | Third-party license inventory |
| ⬜ `packages/social-bridge` | OpenPost media bridge + native API adapters (planned, name per PLAN.md) |
| ⬜ `packages/video` | Video provider adapters + scene/caption types (planned) |
| ⬜ `packages/visuals` | Shared visual workflow types (planned) |

### Services

| Service | License | Boundary |
| --- | --- | --- |
| `services/comfyui` | GPL-3.0 | runs in compose, called only via `visual-worker` |
| `services/postiz` | AGPL-3.0 | reference / optional sidecar — **never** imported |
| `services/pokee-research` | Apache-2.0 | separate service, HTTP-called from API |

### External clones (not modified)

- `ComfyUI/` — checkout for the service runtime
- `comfyui-extensions/` — vetted custom nodes manifest
- `postiz-app/` — AGPL reference; not the proprietary core
- `PokeeResearchOSS/` — Apache-2.0 research service
- `x-algorithm/` — proprietary ranking foundation
- `nano-claw/` — assistant variant (in-monorepo)

---

## 4. Critical Boundaries

### 4.1 License isolation

- **GPL/AGPL → service**. ComfyUI, Postiz, Plunk, listmonk, Formbricks, Twenty CRM — if used, run in `services/` and call via HTTP. Never imported as a TS package.
- **MIT → fork allowed**. OpenPost, OpenClaw, Marp, Slidev, Excalidraw, Umami, Whisper, rembg, MuseTalk, OpenVoice, Piper — safe to vendor and modify.
- **Special**: Remotion is free for ≤3-person companies. Hyperlink the licence in `packages/licensing/THIRD_PARTY.md` and re-evaluate at team growth.
- **FLUX [dev]** — non-commercial only. Forbidden as a default model. Outputs from FLUX models must be tagged and not used in monetized posts.
- **F5-TTS** — code MIT but pretrained voices CC-BY-NC. Use **OpenVoice / Piper** as the default TTS path.

### 4.2 Security boundaries

- ComfyUI port never exposed publicly. Only `visual-worker` talks to it on the internal Docker network.
- MiniClaw runs **first-party skills only**. `ClawHub` is disabled by config.
- OpenPost ↔ API uses a shared `X-SocialOps-Internal-Token` header. The token never leaves the internal network.
- OAuth tokens for social accounts are encrypted at rest (`packages/security`, AES-GCM with `SOCIALOPS_TOKEN_KEY`). Currently a gap — see TODO Phase 8.
- All user-supplied URLs / workflow JSON are validated; users cannot upload arbitrary ComfyUI workflows.

### 4.3 Approval & compliance gates

- AI drafts → `status = needs_review` always. `canTransitionContent` enforces the transition graph.
- `manual_publish` requires explicit user action via the `/manual-publish` endpoint.
- `publish-package` and `export-package` endpoints return compliance flags (`human_approval_required: true`, `no_auto_posting: true`, `no_auto_dm: true`, `no_browser_automation: true`).
- People-video flow refuses to render fake-testimonial scripts. The script-generation prompt forbids "I've been using" framing unless an `is_real_user: true` flag is set on the UGC brief.

---

## 5. AI Video Engine — Rendering Pipeline (FFmpeg-first as of batch 2)

**Architecture pivot 2026-05-26:** Remotion was demolished. Slideshow text-cards lose on TikTok / Reels. The video engine is now an **FFmpeg-first assembler** that anchors every output on real footage.

The video engine is **layered**. Not every video is fully AI-generated; the safe default is script + real screenshots + simple motion + captions + voiceover. Remotion may return later as an *overlay-only* renderer (PNG-with-alpha title cards composited via FFmpeg) but is not in the assembly path.

```
ContentDraft
   │
   ▼
VideoScript (LLM via MiniClaw or in-API prompts)        ← Level 1 (cheap, default)
   │  status: draft → approved
   ▼
ScenePlan (in-API or worker)
   │
   ▼
AssetPlan (BrollPlan rows)
   │   • screenshots         → Playwright
   │   • screen recordings   → Playwright video
   │   • uploaded media      → media_assets
   │   • AI b-roll image     → ComfyUI (visual-worker)
   │   • AI b-roll video     → ComfyUI Wan/LTX OR external (Runway/Luma/Pika)
   │   • avatar              → HeyGen (paid only)
   │   • voiceover           → OpenVoice / Piper (local)  ← PLAN1
   │   • captions            → Whisper / WhisperX (local) ← PLAN1
   │
   ▼
VideoJob (queue + status)
   │
   ▼
Remotion render (apps/video-worker)                     ← Level 2 (template render)
   │   templates: career_lesson_vertical, linkedin_pro_update,
   │              founder_weekly_update, product_demo,
   │              project_build_log, carousel_to_video,
   │              pitch, launch, avatar_explainer, screen_recording_demo
   │
   ▼
FFmpeg post-process
   │   • burn-in captions
   │   • resize per platform (9:16 / 16:9 / 1:1 / 4:5)
   │   • trim / stitch
   │   • CTA card append
   │   • final MP4 mux
   │
   ▼
VideoAsset (status: rendered)
   │
   ▼
Approval (status: approved | rejected)
   │
   ▼
Attach to ContentDraft (media_assets row, source='remotion')
   │
   ▼
Bridge: VideoPostBridge
   │   • POST /api/social/openpost/upload-media  → openpost_media_id
   │   • POST /api/social/openpost/create-post   → openpost_post_id
   │   • POST /api/social/openpost/schedule-post → status: scheduled
   │
   OR manual:
   │
   ▼
Export package (post copy + caption text + upload steps)
```

**Levels — pick the cheapest that fits the format:**

| Level | What | Cost | When |
| --- | --- | --- | --- |
| 1 | Script-only | $ | TikTok/X scripts on free tier |
| 2 | Remotion template render | $$ | Default production path |
| 3 | Playwright product demo | $$ | Real SaaS demo content |
| 4 | ComfyUI b-roll (local GPU) | $$$ | Background visuals on Mac/Studio |
| 4-ext | Runway/Luma/Pika b-roll | $$$$ | Cinematic clips — paid plans only |
| 5 | Avatar (HeyGen) | $$$$$ | Talking-head — Founder/Studio plan only |

**Hardware reality (per PLAN1.md §22):** local dev is a MacBook with no NVIDIA GPU. Default media runtime is `macbook_local`. Heavy ComfyUI video/audio/voice workflows are saved as drafts until a GPU runtime is configured.

---

## 6. Data Flow — End-to-End Loop

```
Capture           → capture_notes (daily/weekly/lesson/work_log/...)
Research          → research_briefs (PokeeResearch)
Identity          → personal_profile, career_profile, brand_profile
Source-of-truth   → projects, social_identities, social_accounts, approved/forbidden_claims
                    ↓
Generate          → content_drafts (status=needs_review)
                       │
                       ├─ generate-draft           (single channel)
                       ├─ generate-content-set     (multi-channel batch)
                       ├─ generate from ugc_brief
                       └─ generate from research_brief
                    ↓
Rank              → rank-x (x-algorithm scoring; recency, specificity, novelty, media)
                    ↓
Visual            → visual_assets (ComfyUI via visual-worker, allowlisted templates)
Video             → video_scripts → video_jobs → video_assets
                    ↓
Approve           → status=approved (human click only)
                    ↓
Publish path A    → OpenPost: media upload → create post → schedule
Publish path B    → manual export package (download MP4 + post copy + steps)
                    ↓
Track             → content_metrics (manual entry + connected-account sync where supported)
                    ↓
Learn             → feeds back into x-algorithm; ContentHistory informs future generation
```

---

## 7. Multi-Account Orchestration

The operator runs many accounts per platform. Architecture:

- `social_identities` — high-level personas (e.g. "VCPeer builder", "SocialOps founder", "career coach") with their own pillars, voice, positioning.
- `social_accounts` — physical accounts; each `identity_id` (nullable), `platform`, `account_type` (personal | page | brand | community | client), `publishing_status` (manual | openpost | postiz | native_api | disabled).
- Content drafts target a specific identity and a list of channels. The bridge to OpenPost picks the right connected account per channel + identity.
- **Anti-spam guard**: same-content cross-posting is allowed only with rewrite. The platform-specific generator runs once per channel; the result is **not** a copy-paste.
- **Cadence**: per-account schedule + per-identity content pillars. Calendar view aggregates across all accounts so the operator sees the whole week at once.

---

## 8. Frontend Strategy

Two viable paths — pick by **2026-06-15**:

**Path A: keep operator-only.** Stay on `apps/web` Vite + vanilla TS, just for the video pipeline UI. Heavy lifting via `pnpm ops` CLI. Faster, matches README priority. Cost: no team/agency workflows.

**Path B: build the Next.js shell PLAN.md describes.** App Router, sidebar, command bar, /dashboard, /capture, /content, /approvals, /videos, /visuals, /calendar, /analytics, /billing, /admin. shadcn/ui + Tailwind. Cost: 4-6 weeks of frontend work before any new product capability.

**Recommendation:** Path A for now + a third operator-grade tool: an `apps/operator` (Astro or Next.js Static) dashboard that reads the API for the operator's daily flow. Add Path B only after PLAN1 video stack is real, because the UI is only useful once the engine produces real videos.

---

## 9. Existing State (per `GAPS.md`, batch 1 applied)

- 38 API tests passing, type check clean.
- Data models: 31/33 done. Missing TS types for `VisualWorkflowTemplate`; `VisualJob` merged into `visual_assets`.
- API routes: 56/72 done after batch 1.
- V1 acceptance: 18/30 done.
- Build order: 13/38 done, 16 partial, 9 missing.
- PLAN1 stack: 3 integrated, 5 referenced, 11 missing (rembg, Whisper, MuseTalk, LivePortrait, OpenVoice, Piper, kohya, RIFE, WanGP, Blender, Krita).
- VENDOR: 2 forked (OpenPost, OpenClaw), 3 service-isolated (ComfyUI, Postiz, Pokee).

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Remotion templates missing → video render fails on real input | High | Phase 1: ship 5 baseline `.tsx` templates with realistic schemas |
| FFmpeg post-processing stubbed → captions/resize not applied | High | Phase 1: real FFmpeg pipeline with caption burn-in + per-platform encode |
| OpenPost media bridge missing → no real posting | High | Phase 2: bridge routes + integration tests against OpenPost fork |
| Mac-only dev → ComfyUI Wan2.2/LTX can't run locally | Medium | Default `macbook_local` runtime queues heavy workflows; route to external API on paid plans |
| OAuth tokens unencrypted → leak if DB compromised | High | Phase 8: AES-GCM encryption helpers + key rotation playbook |
| Generation hits LLM rate limits cross-account | Medium | usage_events + entitlements already in place; add per-key rate limit |
| FTC violation if scripts default to "I've been using" | High | Phase 5: script generator refuses first-person testimony unless `is_real_user: true` |
| Lost files (services/, VENDOR.md disappeared mid-session) | Medium | Phase 0: confirm git history (or absent) and restore from any backup; add daily snapshot to `infra/backups` |
| FLUX/F5 commercial license accidents | Medium | `packages/licensing` enforces an allowlist; visual-worker refuses non-allowlisted models |
| Postiz AGPL leakage if anyone copies code | High | Code review checklist; CI grep that forbids `from "../../postiz-app"` |
| External AI video provider cost runaway | Medium | Free tier blocks; per-plan monthly caps in `usage.ts` already; add hard $/month per workspace |
| MiniClaw skill drift / untrusted skills | High | `ClawHub` disabled; skill allowlist enforced at runtime |
| `apps/web` is Vite vanilla — far from PLAN.md Next.js spec | Medium | §8 decision; Phase 11 if Path B |

---

## 11. Open Decisions

1. **Frontend path** (§8) — A vs B vs A+operator dashboard. Recommend by 2026-06-15.
2. **GPU runtime** — Mac Studio M-series local vs. rented A100/H100 vs. on-demand Modal/Replicate workflow. Affects PLAN1 phase 3.
3. **Auth provider** — own email/password vs. Clerk/WorkOS. PLAN.md says own; speed says Clerk. Recommend: own + magic-link.
4. **Payment provider** — `paddle | dodo | creem | polar | iyzico | paytr | manual` per PLAN.md. Recommend: `polar` first + manual fallback.
5. **Whisper deployment** — local Python in a separate Docker service vs. inline in video-worker via `whisper.cpp`. Recommend: separate `services/whisper` for parallelism.
6. **Lost-file recovery** — `services/comfyui|postiz|pokee-research` and `VENDOR.md` vanished mid-session. Confirm whether they're recoverable or need to be regenerated from PLAN.md.

---

See `docs/TODO.md` for the phased task list that operationalizes this plan.
